import { AttachmentDeliveryWorker } from "./worker.js";
import { attachmentDeliveryQueue } from "./queue.js";
import { AttachmentDeliveryWorkerConfig } from "../../configs/attachment-delivery-worker.js";
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
    const worker = new AttachmentDeliveryWorker();
    await worker.start();

    const monitoringApp = new Hono();

    setupHealthCheckEndpoint(monitoringApp, "attachment-delivery-worker", () =>
      worker.getStatus()
    );

    setupMetricsEndpoint(monitoringApp, attachmentDeliveryQueue);

    createMonitoringServer(monitoringApp, {
      serviceName: "attachment-delivery-worker",
      port: AttachmentDeliveryWorkerConfig.ATTACHMENT_DELIVERY_WORKER_HEALTHCHECK_PORT,
    });

    setupGracefulShutdown(worker);
  } catch (error) {
    logger.error(error, "Failed to start worker service");
    process.exit(1);
  }
}

void startWorker();
