import { Queue } from "bullmq";
import logger from "../../utils/logger.js";

export interface QueueHealthCheckOptions {
  maxFailedJobs: number;
  maxBacklogJobs: number;
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
    const [waiting, active, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getFailedCount(),
    ]);

    const isHealthy =
      failed < options.maxFailedJobs &&
      waiting + active < options.maxBacklogJobs;

    if (!isHealthy) {
      logger.warn(
        { queueName: queue.name, waiting, active, failed },
        "Queue health check failed"
      );
    }

    return isHealthy;
  } catch (error) {
    logger.error(
      { queueName: queue.name, error },
      "Failed to check queue health"
    );
    return false;
  }
}
