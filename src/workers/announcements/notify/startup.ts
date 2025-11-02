import { AnnouncementsNotifyWorker } from "./worker.js";
import { announcementsNotifyQueue } from "./queue.js";
import { AnnouncementsNotifyWorkerConfig } from "../../../configs/announcementsNotifyWorker.js";
import { setupGracefulShutdown } from "../../shared/shutdown.js";
import { Hono } from "hono";
import {
  setupHealthCheckEndpoint,
  setupMetricsEndpoint,
  createObservabilityServer,
} from "../../../observability/index.js";
import logger from "../../../utils/logger.js";

async function startWorker() {
  try {
    const worker = new AnnouncementsNotifyWorker();
    await worker.start();

    // Create observability server with health check and metrics endpoints
    const observabilityApp = new Hono();

    setupHealthCheckEndpoint(
      observabilityApp,
      "announcements-notify-worker",
      () => worker.getStatus()
    );

    setupMetricsEndpoint(observabilityApp, announcementsNotifyQueue);

    createObservabilityServer(observabilityApp, {
      serviceName: "announcements-notify-worker",
      port: AnnouncementsNotifyWorkerConfig.HEALTHCHECK_PORT,
    });

    setupGracefulShutdown(worker);

    logger.info("Announcements notify worker service started");
  } catch (error) {
    logger.error(error, "Failed to start announcements notify worker service");
    process.exit(1);
  }
}

void startWorker();
