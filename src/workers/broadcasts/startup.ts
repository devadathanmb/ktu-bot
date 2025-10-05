import { BroadcastsWorker } from "./worker.js";
import { BroadcastsWorkerConfig } from "../../configs/broadcastsWorker.js";
import { setupGracefulShutdown } from "../shared/shutdown.js";
import { setupHealthCheckServer } from "../../utils/healthCheck.js";
import logger from "../../utils/logger.js";

async function startWorker() {
  try {
    const worker = new BroadcastsWorker();
    await worker.start();

    // Start healthcheck server
    setupHealthCheckServer(
      "broadcasts-worker",
      BroadcastsWorkerConfig.HEALTHCHECK_PORT,
      async () => {
        const status = await worker.getStatus();
        return status.isRunning && status.redisConnected;
      }
    );

    // Setup graceful shutdown
    setupGracefulShutdown(worker);
  } catch (error) {
    logger.error(error, "Failed to start worker service");
    process.exit(1);
  }
}

void startWorker();
