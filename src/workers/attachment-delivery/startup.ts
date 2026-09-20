import { createWorkerBot } from "../../bot/utils/create-worker-bot.js";
import { initDB } from "../../db/connection.js";
import logger from "../../utils/logger.js";
import { AttachmentDeliveryProcessor } from "./worker.js";
import { attachmentDeliveryQueue } from "./queue.js";
import { AttachmentDeliveryWorkerConfig } from "../../configs/attachment-delivery-worker.js";
import { startWorkerMonitoring } from "../shared/start-worker.js";
import { createWorker } from "../shared/worker-runtime.js";
import { createWorkerShutdown } from "../shared/worker-shutdown.js";

const serviceName = "attachment-delivery-worker";

async function start(): Promise<void> {
  try {
    // Telegram error recovery updates chat and subscription records.
    await initDB();
    const bot = createWorkerBot();
    logger.info("Bot instance created");

    const processor = new AttachmentDeliveryProcessor(
      bot,
      attachmentDeliveryQueue
    );
    const worker = await createWorker({
      workerName: serviceName,
      queue: attachmentDeliveryQueue,
      processor: job => processor.process(job),
      concurrency: 2,
      healthCheck: {
        maxFailedJobs: AttachmentDeliveryWorkerConfig.MAX_FAILED_JOBS,
        maxBacklogJobs: AttachmentDeliveryWorkerConfig.MAX_BACKLOG_JOBS,
        failedJobsLookbackMinutes:
          AttachmentDeliveryWorkerConfig.FAILED_JOBS_WINDOW_MINUTES,
      },
    });

    startWorkerMonitoring({
      worker,
      queue: attachmentDeliveryQueue,
      serviceName,
      port: AttachmentDeliveryWorkerConfig.ATTACHMENT_DELIVERY_WORKER_HEALTHCHECK_PORT,
      stop: createWorkerShutdown(worker),
    });
  } catch (error) {
    logger.error({ err: error, serviceName }, "Failed to start worker service");
    process.exit(1);
  }
}

void start();
