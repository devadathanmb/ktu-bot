import { z } from "zod";

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
  MAX_FAILED_JOBS: z.coerce.number().positive().default(10),
  MAX_BACKLOG_JOBS: z.coerce.number().positive().default(20),
  FAILED_JOBS_WINDOW_MINUTES: z.coerce.number().positive().default(15),
});

export const DataSyncWorkerConfig = dataSyncWorkerConfigSchema.parse({
  HEALTHCHECK_PORT: process.env.DATA_SYNC_WORKER_HEALTHCHECK_PORT,
  SYNC_SCHEDULE: process.env.DATA_SYNC_WORKER_SYNC_SCHEDULE,
  MAX_FAILED_JOBS: process.env.DATA_SYNC_WORKER_MAX_FAILED_JOBS,
  MAX_BACKLOG_JOBS: process.env.DATA_SYNC_WORKER_MAX_BACKLOG_JOBS,
  FAILED_JOBS_WINDOW_MINUTES:
    process.env.DATA_SYNC_WORKER_FAILED_JOBS_WINDOW_MINUTES,
});
