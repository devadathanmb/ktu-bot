import { DataSyncWorker } from "./worker.js";
import { dataSyncQueue } from "./queue.js";
import { DataSyncWorkerConfig } from "../../configs/dataSyncWorker.js";
import { setupGracefulShutdown } from "../shared/shutdown.js";
import { Hono } from "hono";
import {
  setupHealthCheckEndpoint,
  setupMetricsEndpoint,
  createObservabilityServer,
} from "../../observability/index.js";
import logger from "../../utils/logger.js";

async function startWorker() {
  try {
    const worker = new DataSyncWorker();
    await worker.start();

    // Create observability server with health check and metrics endpoints
    const observabilityApp = new Hono();

    setupHealthCheckEndpoint(observabilityApp, "data-sync-worker", () =>
      worker.getStatus()
    );

    setupMetricsEndpoint(observabilityApp, dataSyncQueue);

    createObservabilityServer(observabilityApp, {
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
