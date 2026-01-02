import { z } from "zod";

const attachmentDeliveryWorkerConfigSchema = z.object({
  ATTACHMENT_DELIVERY_WORKER_HEALTHCHECK_PORT: z
    .string()
    .transform(val => parseInt(val, 10)),
});

export const AttachmentDeliveryWorkerConfig =
  attachmentDeliveryWorkerConfigSchema.parse({
    ATTACHMENT_DELIVERY_WORKER_HEALTHCHECK_PORT:
      process.env.ATTACHMENT_DELIVERY_WORKER_HEALTHCHECK_PORT,
  });
