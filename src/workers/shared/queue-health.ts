import { Queue } from "bullmq";
import logger from "../../utils/logger.js";

const MAX_FAILED_JOBS_TO_INSPECT = 50;

export interface QueueHealthCheckOptions {
  maxFailedJobs: number;
  maxBacklogJobs: number;
  failedJobsLookbackMinutes: number;
}

/**
 * Count failed jobs within a time window by inspecting individual job timestamps.
 * Jobs are sorted newest-first by default, so we stop at the first job outside the window.
 */
async function getFailedCountWithinWindow(
  queue: Queue,
  lookbackMinutes: number
): Promise<number> {
  const windowMs = lookbackMinutes * 60 * 1000;
  const cutoff = Date.now() - windowMs;

  const jobs = await queue.getFailed(0, MAX_FAILED_JOBS_TO_INSPECT);

  let count = 0;
  let lastJobTimestamp: number | undefined;

  for (const job of jobs) {
    const finishedOn = job.finishedOn;
    if (finishedOn === undefined) {
      continue;
    }

    lastJobTimestamp = finishedOn;

    if (finishedOn >= cutoff) {
      count++;
    } else {
      // Jobs are sorted newest-first; first job outside window means we're done
      break;
    }
  }

  // Warn if we might have truncated the window because we hit the fetch limit
  if (
    jobs.length === MAX_FAILED_JOBS_TO_INSPECT &&
    lastJobTimestamp !== undefined &&
    lastJobTimestamp >= cutoff
  ) {
    logger.warn(
      {
        queueName: queue.name,
        inspected: jobs.length,
        lookbackMinutes,
      },
      "Failed jobs fetch limit reached within lookback window; count may be underreported"
    );
  }

  return count;
}

/**
 * Check the health of a BullMQ queue
 * @param queue - The BullMQ queue to check
 * @param options - Health check thresholds
 * @returns true if queue is healthy, false otherwise
 */
export async function checkQueueHealth(
  queue: Queue,
  options: QueueHealthCheckOptions
): Promise<boolean> {
  try {
    const [waiting, active] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
    ]);

    const failed = await getFailedCountWithinWindow(
      queue,
      options.failedJobsLookbackMinutes
    );

    const isHealthy =
      failed < options.maxFailedJobs &&
      waiting + active < options.maxBacklogJobs;
    const queueName = queue.name;

    if (!isHealthy) {
      logger.warn(
        { queueName, waiting, active, failed },
        "Queue health check failed"
      );
    }

    return isHealthy;
  } catch (error) {
    const queueName = queue.name;
    logger.error(
      { queueName, err: error as Error },
      "Failed to check queue health"
    );
    return false;
  }
}
