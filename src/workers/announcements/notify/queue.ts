import { Queue } from "bullmq";
import { queueRedisConnectionOptions } from "../../shared/redis.js";
import { AnnouncementsNotifyWorkerConfig } from "../../../configs/announcements-notify-worker.js";
import logger from "../../../utils/logger.js";

export const ANNOUNCEMENTS_NOTIFY_QUEUE = "ANNOUNCEMENTS_NOTIFY_QUEUE";

// Queue for announcement notification jobs with automatic retry
export const announcementsNotifyQueue = new Queue<Record<string, never>>(
  ANNOUNCEMENTS_NOTIFY_QUEUE,
  {
    connection: queueRedisConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 60 * 1000,
      },
      removeOnComplete: {
        count: 50,
        age: 24 * 60 * 60,
      },
      removeOnFail: {
        count: 50,
        age: 24 * 60 * 60,
      },
    },
  }
);

// Manually schedule a single notification check (for testing/admin use)
export async function scheduleAnnouncementNotifyJob() {
  await announcementsNotifyQueue.add(
    "announcements-notify:manual",
    {},
    {
      jobId: `announcement-notify-${Date.now()}`,
    }
  );

  logger.info(
    { queueName: ANNOUNCEMENTS_NOTIFY_QUEUE },
    "Scheduled announcement notification job"
  );
}

// Set up recurring notification checks
// This is called once on worker startup - BullMQ handles the recurring schedule
export async function setupRecurringSchedule() {
  await announcementsNotifyQueue.add(
    "announcements-notify:recurring",
    {},
    {
      repeat: {
        pattern: AnnouncementsNotifyWorkerConfig.CRON_SCHEDULE,
      },
      jobId: "recurring-announcements-notify",
    }
  );

  logger.info(
    {
      queueName: ANNOUNCEMENTS_NOTIFY_QUEUE,
      schedule: AnnouncementsNotifyWorkerConfig.CRON_SCHEDULE,
    },
    "Set up recurring announcement notifications"
  );
}
