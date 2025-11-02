import { DataSyncWorker } from "./worker.js";
import { dataSyncQueue } from "./queue.js";
import { DataSyncWorkerConfig } from "../../configs/dataSyncWorker.js";
import { setupGracefulShutdown } from "../shared/shutdown.js";
import { Hono } from "hono";
import {
  setupHealthCheckEndpoint,
  setupMetricsEndpoint,
  createMonitoringServer,
} from "../../monitoring/index.js";
import logger from "../../utils/logger.js";

async function startWorker() {
  try {
    const worker = new DataSyncWorker();
    await worker.start();

    // Create monitoring server with health check and metrics endpoints
    const monitoringApp = new Hono();

    setupHealthCheckEndpoint(monitoringApp, "data-sync-worker", () =>
      worker.getStatus()
    );

    setupMetricsEndpoint(monitoringApp, dataSyncQueue);

    createMonitoringServer(monitoringApp, {
      serviceName: "data-sync-worker",
      port: DataSyncWorkerConfig.HEALTHCHECK_PORT,
    });

    setupGracefulShutdown(worker);

    logger.info("Data sync worker service started");
  } catch (error) {
    logger.error(error, "Failed to start data sync worker service");
    process.exit(1);
  }
}

void startWorker();
