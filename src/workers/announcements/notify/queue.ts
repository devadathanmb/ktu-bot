import { AnnouncementsNotifyWorkerConfig } from "../../../configs/announcements-notify-worker.js";
import logger from "../../../utils/logger.js";
import { createQueue } from "../../shared/create-queue.js";

export const ANNOUNCEMENTS_NOTIFY_QUEUE = "ANNOUNCEMENTS_NOTIFY_QUEUE";

export const announcementsNotifyQueue = createQueue<Record<string, never>>({
  name: ANNOUNCEMENTS_NOTIFY_QUEUE,
  defaultJobOptions: {
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50, age: 24 * 60 * 60 },
  },
});

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
