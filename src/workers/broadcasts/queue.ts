import { BroadcastJob } from "../shared/types.js";
import logger from "../../utils/logger.js";
import { createQueue } from "../shared/create-queue.js";

export const BROADCASTS_QUEUE = "BROADCASTS_QUEUE";

export const broadcastsQueue = createQueue<BroadcastJob>({
  name: BROADCASTS_QUEUE,
  defaultJobOptions: {
    removeOnFail: { count: 50 },
  },
});

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
