import { AnnouncementsNotifyWorker } from "./worker.js";
import { AnnouncementsNotifyWorkerConfig } from "../../../configs/announcementsNotifyWorker.js";
import { setupGracefulShutdown } from "../../shared/shutdown.js";
import { setupHealthCheckServer } from "../../../utils/healthCheck.js";
import logger from "../../../utils/logger.js";

async function startWorker() {
  try {
    const worker = new AnnouncementsNotifyWorker();
    await worker.start();

    setupHealthCheckServer(
      "announcements-notify-worker",
      AnnouncementsNotifyWorkerConfig.HEALTHCHECK_PORT,
      async () => {
        const status = await worker.getStatus();
        return status.isRunning && status.queueHealth;
      }
    );

    setupGracefulShutdown(worker);

    logger.info("Announcements notify worker service started");
  } catch (error) {
    logger.error(error, "Failed to start announcements notify worker service");
    process.exit(1);
  }
}

startWorker();
