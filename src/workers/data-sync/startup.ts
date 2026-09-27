import { DataSyncProcessor } from "./worker.js";
import { dataSyncQueue, setupRecurringSchedule } from "./queue.js";
import { AnnouncementsSyncer } from "./syncers/announcements.js";
import { AcademicCalendarsSyncer as CalendarsSyncer } from "./syncers/academic-calendars.js";
import { ExamTimetablesSyncer } from "./syncers/exam-timetables.js";
import { baseApiClient } from "../../api/client.js";
import { DataSyncWorkerConfig } from "../../configs/data-sync-worker.js";
import { closeDB, initDB } from "../../db/connection.js";
import { withTransaction } from "../../db/transactions.js";
import logger from "../../utils/logger.js";
import { startWorkerMonitoring } from "../shared/start-worker.js";
import { createWorker } from "../shared/worker-runtime.js";

const serviceName = "data-sync-worker";

async function start(): Promise<void> {
  try {
    // Initial sync runs one long transaction of small bulk upserts (batches
    // capped at 2000 rows). The limit below bounds individual statements,
    // not the whole transaction: a healthy bulk write finishes in seconds,
    // while a true stall fails the job so BullMQ retries instead of hanging.
    const db = await initDB({
      applicationName: serviceName,
      statementTimeoutMs: 5 * 60_000,
    });
    const processor = new DataSyncProcessor({
      syncers: {
        "data-sync:announcements": new AnnouncementsSyncer(
          db,
          baseApiClient,
          withTransaction
        ),
        "data-sync:academic-calendars": new CalendarsSyncer(
          db,
          baseApiClient,
          withTransaction
        ),
        "data-sync:exam-timetables": new ExamTimetablesSyncer(
          db,
          baseApiClient,
          withTransaction
        ),
      },
      enqueueSyncJob: job => dataSyncQueue.add(job.name, job.data),
    });
    const worker = await createWorker({
      workerName: serviceName,
      queue: dataSyncQueue,
      processor: job => processor.process(job),
      concurrency: 1,
      healthCheck: {
        maxFailedJobs: DataSyncWorkerConfig.MAX_FAILED_JOBS,
        maxBacklogJobs: DataSyncWorkerConfig.MAX_BACKLOG_JOBS,
        failedJobsLookbackMinutes:
          DataSyncWorkerConfig.FAILED_JOBS_WINDOW_MINUTES,
      },
    });

    await processor.scheduleInitialSync();
    await setupRecurringSchedule();

    startWorkerMonitoring({
      worker,
      queue: dataSyncQueue,
      serviceName,
      port: DataSyncWorkerConfig.HEALTHCHECK_PORT,
      closeDB,
    });
  } catch (error) {
    logger.error({ err: error, serviceName }, "Failed to start worker service");
    process.exit(1);
  }
}

void start();
