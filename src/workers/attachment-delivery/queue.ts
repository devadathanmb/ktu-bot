import { Queue } from "bullmq";
import { queueRedisConnectionOptions } from "../shared/redis.js";
import { Attachment } from "../../types/service.types.js";
import logger from "../../utils/logger.js";

export const ATTACHMENT_DELIVERY_QUEUE = "ATTACHMENT_DELIVERY_QUEUE";

export interface AttachmentDeliveryJob {
  chatId: number;
  attachments: Attachment[];
  statusMessageId?: number;
  replyToMessageId?: number;
  context: string;
  sendViewAnotherMessage?: boolean;
}

export const attachmentDeliveryQueue = new Queue<AttachmentDeliveryJob>(
  ATTACHMENT_DELIVERY_QUEUE,
  {
    connection: queueRedisConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 10 * 1000,
      },
      removeOnComplete: {
        count: 200,
        age: 24 * 60 * 60,
      },
      removeOnFail: {
        count: 50,
      },
    },
  }
);

export async function addAttachmentDeliveryJob(jobData: AttachmentDeliveryJob) {
  const job = await attachmentDeliveryQueue.add("attachment:deliver", jobData);
  const jobId = job.id;
  const { chatId, context } = jobData;
  logger.debug(
    { jobId, chatId, context, queueName: ATTACHMENT_DELIVERY_QUEUE },
    "Added attachment delivery job"
  );
  return job;
}
