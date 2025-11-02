import { BroadcastsWorker } from "./worker.js";
import { broadcastsQueue } from "./queue.js";
import { BroadcastsWorkerConfig } from "../../configs/broadcastsWorker.js";
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
    const worker = new BroadcastsWorker();
    await worker.start();

    // Create monitoring server with health check and metrics endpoints
    const monitoringApp = new Hono();

    setupHealthCheckEndpoint(monitoringApp, "broadcasts-worker", () =>
      worker.getStatus()
    );

    setupMetricsEndpoint(monitoringApp, broadcastsQueue);

    createMonitoringServer(monitoringApp, {
      serviceName: "broadcasts-worker",
      port: BroadcastsWorkerConfig.HEALTHCHECK_PORT,
    });

    // Setup graceful shutdown
    setupGracefulShutdown(worker);
  } catch (error) {
    logger.error(error, "Failed to start worker service");
    process.exit(1);
  }
}

void startWorker();
