import { DataSyncProcessor } from "./worker.js";
import { dataSyncQueue, setupRecurringSchedule } from "./queue.js";
import { AnnouncementsSyncer } from "./syncers/announcements.js";
import { AcademicCalendarsSyncer as CalendarsSyncer } from "./syncers/academic-calendars.js";
import { ExamTimetablesSyncer } from "./syncers/exam-timetables.js";
import { baseApiClient } from "../../api/client.js";
import { DataSyncWorkerConfig } from "../../configs/data-sync-worker.js";
import { initDB } from "../../db/connection.js";
import logger from "../../utils/logger.js";
import { startWorkerMonitoring } from "../shared/start-worker.js";
import { createWorker } from "../shared/worker-runtime.js";
import { createWorkerShutdown } from "../shared/worker-shutdown.js";

const serviceName = "data-sync-worker";

async function start(): Promise<void> {
  try {
    const db = await initDB();
    const processor = new DataSyncProcessor({
      syncers: {
        "data-sync:announcements": new AnnouncementsSyncer(db, baseApiClient),
        "data-sync:academic-calendars": new CalendarsSyncer(db, baseApiClient),
        "data-sync:exam-timetables": new ExamTimetablesSyncer(
          db,
          baseApiClient
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
      stop: createWorkerShutdown(worker),
    });
  } catch (error) {
    logger.error({ err: error, serviceName }, "Failed to start worker service");
    process.exit(1);
  }
}

void start();
