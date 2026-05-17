import { z } from "zod";
import { CRON_REGEX } from "../constants/cron.js";

const dataSyncWorkerConfigSchema = z.object({
  HEALTHCHECK_PORT: z.coerce.number().positive(),
  SYNC_SCHEDULE: z
    .string()
    .regex(CRON_REGEX, {
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
