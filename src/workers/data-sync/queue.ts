import { DataSyncWorkerConfig } from "../../configs/data-sync-worker.js";
import logger from "../../utils/logger.js";
import { createQueue } from "../shared/create-queue.js";

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

export async function setupRecurringSchedule() {
  await Promise.all([
    dataSyncQueue.add(
      "data-sync:announcements",
      {
        syncType: "data-sync:announcements",
      },
      {
        repeat: {
          pattern: DataSyncWorkerConfig.SYNC_SCHEDULE,
        },
        jobId: "recurring-sync-announcements",
      }
    ),
    dataSyncQueue.add(
      "data-sync:academic-calendars",
      {
        syncType: "data-sync:academic-calendars",
      },
      {
        repeat: {
          pattern: DataSyncWorkerConfig.SYNC_SCHEDULE,
        },
        jobId: "recurring-sync-calendars",
      }
    ),
    dataSyncQueue.add(
      "data-sync:exam-timetables",
      {
        syncType: "data-sync:exam-timetables",
      },
      {
        repeat: {
          pattern: DataSyncWorkerConfig.SYNC_SCHEDULE,
        },
        jobId: "recurring-sync-exam-timetables",
      }
    ),
  ]);

  logger.info(
    {
      queueName: DATA_SYNC_QUEUE,
      schedule: DataSyncWorkerConfig.SYNC_SCHEDULE,
    },
    "Set up recurring data sync"
  );
}
