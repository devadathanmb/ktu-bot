import { DataSyncWorkerConfig } from "../../configs/data-sync-worker.js";
import logger from "../../utils/logger.js";
import { createQueue } from "../shared/create-queue.js";
import {
  setupRecurringSchedules,
  type RecurringJobSchedule,
} from "../shared/recurring-schedules.js";

export const DATA_SYNC_QUEUE = "DATA_SYNC_QUEUE";

export type SyncJobType =
  | "data-sync:announcements"
  | "data-sync:academic-calendars"
  | "data-sync:exam-timetables";

export interface SyncJobData {
  syncType: SyncJobType;
}

export const dataSyncQueue = createQueue<SyncJobData>({
  name: DATA_SYNC_QUEUE,
  defaultJobOptions: {
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50, age: 24 * 60 * 60 },
  },
});

const RECURRING_SYNCS: readonly RecurringJobSchedule<SyncJobData>[] = [
  {
    schedulerId: "recurring-sync-announcements",
    jobName: "data-sync:announcements",
    data: { syncType: "data-sync:announcements" },
  },
  {
    schedulerId: "recurring-sync-calendars",
    jobName: "data-sync:academic-calendars",
    data: { syncType: "data-sync:academic-calendars" },
  },
  {
    schedulerId: "recurring-sync-exam-timetables",
    jobName: "data-sync:exam-timetables",
    data: { syncType: "data-sync:exam-timetables" },
  },
];

export async function setupRecurringSchedule(): Promise<void> {
  const { removedLegacySchedulerIds } = await setupRecurringSchedules(
    dataSyncQueue,
    RECURRING_SYNCS,
    DataSyncWorkerConfig.SYNC_SCHEDULE
  );

  logger.info(
    {
      queueName: DATA_SYNC_QUEUE,
      schedulerIds: RECURRING_SYNCS.map(schedule => schedule.schedulerId),
      schedule: DataSyncWorkerConfig.SYNC_SCHEDULE,
      removedLegacySchedulerIds,
    },
    "Set up recurring data sync"
  );
}
