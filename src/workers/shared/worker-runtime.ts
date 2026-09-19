import { Job, Queue, Worker } from "bullmq";
import type { Processor } from "bullmq";
import logger from "../../utils/logger.js";
import {
  checkQueueHealth,
  type QueueHealthCheckOptions,
} from "./queue-health.js";
import { workerRedisConnectionOptions } from "./redis.js";

export interface WorkerControl {
  getStatus(): Promise<boolean>;
  close(): Promise<void>;
}

interface CreateWorkerOptions<TJobData> {
  workerName: string;
  queue: Queue<TJobData>;
  processor: Processor<TJobData>;
  concurrency?: number;
  healthCheck?: QueueHealthCheckOptions;
}

async function logJobFailure<TJobData>(
  job: Job<TJobData> | undefined,
  error: Error,
  workerName: string,
  queueName: string
): Promise<void> {
  logger.error(
    { jobId: job?.id, workerName, queueName, err: error },
    "Job failed"
  );

  if (!job) return;

  await job.log(`Job failed: ${error.message}`);
  if (error.stack) {
    await job.log(`Stack trace: ${error.stack}`);
  }
}

export async function createWorker<TJobData>(
  options: CreateWorkerOptions<TJobData>
): Promise<WorkerControl> {
  const redisClient = await options.queue.client;
  await redisClient.ping();
  logger.info(
    { workerName: options.workerName, queueName: options.queue.name },
    "Redis connection established"
  );

  const worker = new Worker<TJobData>(options.queue.name, options.processor, {
    connection: workerRedisConnectionOptions,
    concurrency: options.concurrency ?? 1,
    maxStalledCount: 5,
  });

  worker.on("completed", job => {
    logger.info(
      {
        jobId: job.id,
        workerName: options.workerName,
        queueName: options.queue.name,
      },
      "Job completed"
    );
  });

  worker.on("failed", (job, error) => {
    void logJobFailure(
      job,
      error,
      options.workerName,
      options.queue.name
    ).catch(logError => {
      logger.error(
        {
          jobId: job?.id,
          workerName: options.workerName,
          queueName: options.queue.name,
          err: logError,
        },
        "Failed to write failure details to job log"
      );
    });
  });

  worker.on("error", error => {
    logger.error(
      {
        workerName: options.workerName,
        queueName: options.queue.name,
        err: error,
      },
      "Worker error"
    );
  });

  logger.info(
    { workerName: options.workerName, queueName: options.queue.name },
    "Worker started"
  );

  return {
    async getStatus(): Promise<boolean> {
      if (!worker.isRunning()) return false;

      try {
        await redisClient.ping();

        if (options.healthCheck) {
          return await checkQueueHealth(options.queue, options.healthCheck);
        }

        return true;
      } catch (error) {
        logger.warn(
          {
            workerName: options.workerName,
            queueName: options.queue.name,
            err: error,
          },
          "Health check failed"
        );
        return false;
      }
    },

    async close(): Promise<void> {
      await worker.close();
      await options.queue.close();
      logger.info(
        { workerName: options.workerName, queueName: options.queue.name },
        "Worker stopped"
      );
    },
  };
}
