import { Queue, type JobsOptions } from "bullmq";
import { queueRedisConnectionOptions } from "./redis.js";

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { count: 200, age: 24 * 60 * 60 },
  removeOnFail: { count: 200 },
};

interface CreateQueueOptions {
  name: string;
  defaultJobOptions?: Partial<JobsOptions>;
}

export function createQueue<T = unknown>(
  options: CreateQueueOptions
): Queue<T> {
  return new Queue<T>(options.name, {
    connection: queueRedisConnectionOptions,
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      ...options.defaultJobOptions,
    },
  });
}
