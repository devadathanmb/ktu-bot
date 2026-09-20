import { setTimeout } from "node:timers/promises";
import { autoRetry } from "@grammyjs/auto-retry";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { LLMService } from "../../../api/services/llm/index.js";
import { createWorkerBot } from "../../../bot/utils/create-worker-bot.js";
import { AnnouncementsNotifyWorkerConfig } from "../../../configs/announcements-notify-worker.js";
import { closeDB, initDB } from "../../../db/connection.js";
import logger from "../../../utils/logger.js";
import { createWorker } from "../../shared/worker-runtime.js";
import { startWorkerMonitoring } from "../../shared/start-worker.js";
import { createAnnouncementAudienceResolver } from "./audience.js";
import { announcementsNotifyQueue, setupRecurringSchedule } from "./queue.js";
import { AnnouncementsNotifyProcessor } from "./worker.js";

const serviceName = "announcements-notify-worker";

async function start(): Promise<void> {
  try {
    const db = await initDB();
    const bot = createWorkerBot();
    bot.api.config.use(apiThrottler());
    bot.api.config.use(autoRetry({ maxRetryAttempts: 5 }));
    logger.info("Bot instance created with throttler and auto-retry");

    const classifier = new LLMService();
    const resolveAudience = createAnnouncementAudienceResolver({
      classifier,
      sleep: milliseconds => setTimeout(milliseconds),
    });
    const processor = new AnnouncementsNotifyProcessor(
      db,
      bot,
      resolveAudience
    );
    const worker = await createWorker({
      workerName: serviceName,
      queue: announcementsNotifyQueue,
      processor: job => processor.process(job),
      concurrency: 1,
      healthCheck: {
        maxFailedJobs: AnnouncementsNotifyWorkerConfig.MAX_FAILED_JOBS,
        maxBacklogJobs: AnnouncementsNotifyWorkerConfig.MAX_BACKLOG_JOBS,
        failedJobsLookbackMinutes:
          AnnouncementsNotifyWorkerConfig.FAILED_JOBS_WINDOW_MINUTES,
      },
    });

    logger.info("Scheduling initial announcement notification check");
    await announcementsNotifyQueue.add(
      "announcements-notify:initial",
      {},
      {
        jobId: `announcement-notify-initial-${Date.now()}`,
      }
    );
    await setupRecurringSchedule();

    startWorkerMonitoring({
      worker,
      queue: announcementsNotifyQueue,
      serviceName,
      port: AnnouncementsNotifyWorkerConfig.HEALTHCHECK_PORT,
      closeDB,
    });
  } catch (error) {
    logger.error({ err: error, serviceName }, "Failed to start worker service");
    process.exit(1);
  }
}

void start();
