import { Queue } from "bullmq";
import { queueRedisConnectionOptions } from "../../shared/redis.js";
import { AnnouncementsNotifyWorkerConfig } from "../../../configs/announcements-notify-worker.js";
import logger from "../../../utils/logger.js";

export const ANNOUNCEMENTS_NOTIFY_QUEUE = "ANNOUNCEMENTS_NOTIFY_QUEUE";

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
