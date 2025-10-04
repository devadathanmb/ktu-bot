import { DataSyncWorker } from "./worker.js";
import { DataSyncWorkerConfig } from "../../configs/dataSyncWorker.js";
import { setupGracefulShutdown } from "../shared/shutdown.js";
import { setupHealthCheckServer } from "../../utils/healthCheck.js";
import logger from "../../utils/logger.js";

async function startWorker() {
  try {
    const worker = new DataSyncWorker();
    await worker.start();

    setupHealthCheckServer(
      "data-sync-worker",
      DataSyncWorkerConfig.HEALTHCHECK_PORT,
      async () => {
        const status = await worker.getStatus();
        return status.isRunning && status.queueHealth;
      }
    );

    setupGracefulShutdown(worker);

    logger.info("Data sync worker service started");
  } catch (error) {
    logger.error(error, "Failed to start data sync worker service");
    process.exit(1);
  }
}

startWorker();
