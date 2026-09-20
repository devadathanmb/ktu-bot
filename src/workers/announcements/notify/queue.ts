import { AnnouncementsNotifyWorkerConfig } from "../../../configs/announcements-notify-worker.js";
import logger from "../../../utils/logger.js";
import { createQueue } from "../../shared/create-queue.js";
import {
  setupRecurringSchedules,
  type RecurringJobSchedule,
} from "../../shared/recurring-schedules.js";

export const ANNOUNCEMENTS_NOTIFY_QUEUE = "ANNOUNCEMENTS_NOTIFY_QUEUE";

export const announcementsNotifyQueue = createQueue<Record<string, never>>({
  name: ANNOUNCEMENTS_NOTIFY_QUEUE,
  defaultJobOptions: {
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50, age: 24 * 60 * 60 },
  },
});

const RECURRING_NOTIFICATIONS: readonly RecurringJobSchedule<
  Record<string, never>
>[] = [
  {
    schedulerId: "recurring-announcements-notify",
    jobName: "announcements-notify:recurring",
    data: {},
  },
];

export async function setupRecurringSchedule(): Promise<void> {
  const { removedLegacySchedulerIds } = await setupRecurringSchedules(
    announcementsNotifyQueue,
    RECURRING_NOTIFICATIONS,
    AnnouncementsNotifyWorkerConfig.CRON_SCHEDULE
  );

  logger.info(
    {
      queueName: ANNOUNCEMENTS_NOTIFY_QUEUE,
      schedulerIds: RECURRING_NOTIFICATIONS.map(
        schedule => schedule.schedulerId
      ),
      schedule: AnnouncementsNotifyWorkerConfig.CRON_SCHEDULE,
      removedLegacySchedulerIds,
    },
    "Set up recurring announcement notifications"
  );
}
