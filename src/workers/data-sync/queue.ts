import { Queue } from "bullmq";
import { queueRedisConnectionOptions } from "../shared/redis.js";
import { DataSyncWorkerConfig } from "../../configs/data-sync-worker.js";
import logger from "../../utils/logger.js";

export const DATA_SYNC_QUEUE = "DATA_SYNC_QUEUE";

export type SyncJobType =
  | "data-sync:announcements"
  | "data-sync:academic-calendars"
  | "data-sync:exam-timetables";

export interface SyncJobData {
  syncType: SyncJobType;
  scheduledAt: number;
}

// Queue for data synchronization jobs with automatic retry
export const dataSyncQueue = new Queue<SyncJobData>(DATA_SYNC_QUEUE, {
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
});

// Manually trigger sync jobs for all data types (for testing/admin use)
export async function scheduleSyncJobs() {
  const timestamp = Date.now();

  await Promise.all([
    dataSyncQueue.add("data-sync:announcements", {
      syncType: "data-sync:announcements",
      scheduledAt: timestamp,
    }),
    dataSyncQueue.add("data-sync:academic-calendars", {
      syncType: "data-sync:academic-calendars",
      scheduledAt: timestamp,
    }),
    dataSyncQueue.add("data-sync:exam-timetables", {
      syncType: "data-sync:exam-timetables",
      scheduledAt: timestamp,
    }),
  ]);

  logger.info({ timestamp }, "Manually scheduled all sync jobs");
}

// Set up recurring sync jobs for all data types
// This is called once on worker startup - BullMQ handles the recurring schedule
export async function setupRecurringSchedule() {
  const timestamp = Date.now();

  await Promise.all([
    dataSyncQueue.add(
      "data-sync:announcements",
      {
        syncType: "data-sync:announcements",
        scheduledAt: timestamp,
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
        scheduledAt: timestamp,
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
        scheduledAt: timestamp,
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
    `Set up recurring data sync with schedule: ${DataSyncWorkerConfig.SYNC_SCHEDULE}`
  );
}
