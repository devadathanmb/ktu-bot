import { createWorkerBot } from "../../bot/utils/create-worker-bot.js";
import { BroadcastsWorkerConfig } from "../../configs/broadcasts-worker.js";
import { closeDB, initDB } from "../../db/connection.js";
import logger from "../../utils/logger.js";
import { broadcastsQueue } from "./queue.js";
import { BroadcastProcessor } from "./worker.js";
import { startWorkerMonitoring } from "../shared/start-worker.js";
import { createWorker } from "../shared/worker-runtime.js";
import { createWorkerShutdown } from "../shared/worker-shutdown.js";

const serviceName = "broadcasts-worker";

async function start(): Promise<void> {
  try {
    const db = await initDB();
    const bot = createWorkerBot();
    logger.info("Bot instance created");

    const processor = new BroadcastProcessor(db, bot, broadcastsQueue);
    const worker = await createWorker({
      workerName: serviceName,
      queue: broadcastsQueue,
      processor: job => processor.process(job),
      concurrency: 1,
      healthCheck: {
        maxFailedJobs: BroadcastsWorkerConfig.MAX_FAILED_JOBS,
        maxBacklogJobs: BroadcastsWorkerConfig.MAX_BACKLOG_JOBS,
        failedJobsLookbackMinutes:
          BroadcastsWorkerConfig.FAILED_JOBS_WINDOW_MINUTES,
      },
    });

    startWorkerMonitoring({
      worker,
      queue: broadcastsQueue,
      serviceName,
      port: BroadcastsWorkerConfig.HEALTHCHECK_PORT,
      stop: createWorkerShutdown(worker, { closeDB }),
    });
  } catch (error) {
    logger.error({ err: error, serviceName }, "Failed to start worker service");
    process.exit(1);
  }
}

void start();
