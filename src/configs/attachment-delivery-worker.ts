import { z } from "zod";

const attachmentDeliveryWorkerConfigSchema = z.object({
  ATTACHMENT_DELIVERY_WORKER_HEALTHCHECK_PORT: z.coerce.number().positive(),
  MAX_FAILED_JOBS: z.coerce.number().positive().default(20),
  MAX_BACKLOG_JOBS: z.coerce.number().positive().default(100),
  FAILED_JOBS_WINDOW_MINUTES: z.coerce.number().positive().default(15),
});

export const AttachmentDeliveryWorkerConfig =
  attachmentDeliveryWorkerConfigSchema.parse({
    ATTACHMENT_DELIVERY_WORKER_HEALTHCHECK_PORT:
      process.env.ATTACHMENT_DELIVERY_WORKER_HEALTHCHECK_PORT,
    MAX_FAILED_JOBS: process.env.ATTACHMENT_DELIVERY_WORKER_MAX_FAILED_JOBS,
    MAX_BACKLOG_JOBS: process.env.ATTACHMENT_DELIVERY_WORKER_MAX_BACKLOG_JOBS,
    FAILED_JOBS_WINDOW_MINUTES:
      process.env.ATTACHMENT_DELIVERY_WORKER_FAILED_JOBS_WINDOW_MINUTES,
  });
