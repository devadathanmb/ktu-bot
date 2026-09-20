import { DataSyncProcessor } from "./worker.js";
import { dataSyncQueue, setupRecurringSchedule } from "./queue.js";
import { DataSyncWorkerConfig } from "../../configs/data-sync-worker.js";
import { closeDB, initDB } from "../../db/connection.js";
import logger from "../../utils/logger.js";
import { startWorkerMonitoring } from "../shared/start-worker.js";
import { createWorker } from "../shared/worker-runtime.js";

const serviceName = "data-sync-worker";

async function start(): Promise<void> {
  try {
    const db = await initDB();
    const processor = new DataSyncProcessor(db);
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
      stop: async () => {
        await worker.close();
        await closeDB();
      },
    });
  } catch (error) {
    logger.error({ err: error, serviceName }, "Failed to start worker service");
    process.exit(1);
  }
}

void start();
