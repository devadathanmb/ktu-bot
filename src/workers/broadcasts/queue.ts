import { Queue } from "bullmq";
import { queueRedisConnectionOptions } from "../shared/redis.js";
import { BroadcastJob } from "../shared/types.js";
import logger from "../../utils/logger.js";

export const BROADCASTS_QUEUE = "BROADCASTS_QUEUE";

// Queue for broadcast jobs with automatic retry
export const broadcastsQueue = new Queue<BroadcastJob>(BROADCASTS_QUEUE, {
  connection: queueRedisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 10 * 1000, // 10 seconds
    },
    removeOnComplete: {
      count: 200, // Keep last 200 completed jobs
      age: 24 * 60 * 60, // Keep for 24 hours
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs for debugging
    },
  },
});

// Bulk add broadcast jobs
export async function addBroadcastJobs(jobsData: BroadcastJob[]) {
  const jobs = jobsData.map(jobData => ({
    name: "broadcast:send",
    data: jobData,
  }));

  const results = await broadcastsQueue.addBulk(jobs);
  const jobCount = results.length;
  logger.debug(
    { jobCount, queueName: BROADCASTS_QUEUE },
    "Added broadcast jobs in bulk"
  );
  return results;
}

// Add a single broadcast job
export async function addBroadcastJob(jobData: BroadcastJob) {
  const job = await broadcastsQueue.add("broadcast:send", jobData);
  const jobId = job.id;
  logger.debug(
    { jobId, queueName: BROADCASTS_QUEUE },
    "Added single broadcast job"
  );
  return job;
}
