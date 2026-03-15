import { z } from "zod";

// Cron job regex
const cronRegex =
  /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;

const dataSyncWorkerConfigSchema = z.object({
  HEALTHCHECK_PORT: z.coerce.number().positive(),
  SYNC_SCHEDULE: z
    .string()
    .regex(cronRegex, {
      message: "Invalid cron expression",
    })
    .default("*/30 * * * *"), // Every 30 minutes
});

export const DataSyncWorkerConfig = dataSyncWorkerConfigSchema.parse({
  HEALTHCHECK_PORT: process.env.DATA_SYNC_WORKER_HEALTHCHECK_PORT,
  SYNC_SCHEDULE: process.env.DATA_SYNC_WORKER_SYNC_SCHEDULE,
});
