import { BroadcastJob } from "../shared/types.js";
import logger from "../../utils/logger.js";
import { createQueue } from "../shared/create-queue.js";

export interface BroadcastJobInput {
  data: BroadcastJob;
  jobId?: string;
}

export const BROADCASTS_QUEUE = "BROADCASTS_QUEUE";

export const broadcastsQueue = createQueue<BroadcastJob>({
  name: BROADCASTS_QUEUE,
  defaultJobOptions: {
    removeOnFail: { count: 50 },
  },
});

export async function addBroadcastJobs(jobsData: BroadcastJobInput[]) {
  const jobs = jobsData.map(job => ({
    name: "broadcast:send",
    data: job.data,
    ...(job.jobId !== undefined && { opts: { jobId: job.jobId } }),
  }));

  const results = await broadcastsQueue.addBulk(jobs);
  const jobCount = results.length;
  logger.debug(
    { jobCount, queueName: BROADCASTS_QUEUE },
    "Added broadcast jobs in bulk"
  );
  return results;
}
