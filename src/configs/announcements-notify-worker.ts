import { z } from "zod";
import { CRON_REGEX } from "../constants/cron.js";

const announcementsNotifyWorkerConfigSchema = z.object({
  HEALTHCHECK_PORT: z.coerce.number().positive(),
  DATA_LOOKUP_LIMIT: z.coerce.number().positive(),
  CRON_SCHEDULE: z
    .string()
    .regex(CRON_REGEX, {
      message: "Invalid cron expression",
    })
    .default("*/5 * * * *"), // Every 5 minutes
  MAX_FAILED_JOBS: z.coerce.number().positive().default(5),
  MAX_BACKLOG_JOBS: z.coerce.number().positive().default(10),
  FAILED_JOBS_WINDOW_MINUTES: z.coerce.number().positive().default(15),
});

export const AnnouncementsNotifyWorkerConfig =
  announcementsNotifyWorkerConfigSchema.parse({
    HEALTHCHECK_PORT: process.env.ANNOUNCEMENTS_NOTIFY_WORKER_HEALTHCHECK_PORT,
    CRON_SCHEDULE: process.env.ANNOUNCEMENTS_NOTIFY_WORKER_CRON_SCHEDULE,
    DATA_LOOKUP_LIMIT:
      process.env.ANNOUNCEMENTS_NOTIFY_WORKER_DATA_LOOKUP_LIMIT || 20,
    MAX_FAILED_JOBS: process.env.ANNOUNCEMENTS_NOTIFY_WORKER_MAX_FAILED_JOBS,
    MAX_BACKLOG_JOBS: process.env.ANNOUNCEMENTS_NOTIFY_WORKER_MAX_BACKLOG_JOBS,
    FAILED_JOBS_WINDOW_MINUTES:
      process.env.ANNOUNCEMENTS_NOTIFY_WORKER_FAILED_JOBS_WINDOW_MINUTES,
  });
