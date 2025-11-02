import { BroadcastsWorker, broadcastsQueue } from "./worker.js";
import { BroadcastsWorkerConfig } from "../../configs/broadcastsWorker.js";
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
    const worker = new BroadcastsWorker();
    await worker.start();

    // Create observability server with health check and metrics endpoints
    const observabilityApp = new Hono();

    setupHealthCheckEndpoint(observabilityApp, "broadcasts-worker", () =>
      worker.getStatus()
    );

    setupMetricsEndpoint(observabilityApp, broadcastsQueue);

    createObservabilityServer(observabilityApp, {
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
