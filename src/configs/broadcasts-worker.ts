import { z } from "zod";

const broadcastsWorkerConfigSchema = z.object({
  HEALTHCHECK_PORT: z.coerce.number().positive(),
  MAX_FAILED_JOBS: z.coerce.number().positive().default(30),
  MAX_BACKLOG_JOBS: z.coerce.number().positive().default(2000),
  FAILED_JOBS_WINDOW_MINUTES: z.coerce.number().positive().default(15),
});

export const BroadcastsWorkerConfig = broadcastsWorkerConfigSchema.parse({
  HEALTHCHECK_PORT: process.env.BROADCASTS_WORKER_HEALTHCHECK_PORT,
  MAX_FAILED_JOBS: process.env.BROADCASTS_WORKER_MAX_FAILED_JOBS,
  MAX_BACKLOG_JOBS: process.env.BROADCASTS_WORKER_MAX_BACKLOG_JOBS,
  FAILED_JOBS_WINDOW_MINUTES:
    process.env.BROADCASTS_WORKER_FAILED_JOBS_WINDOW_MINUTES,
});
