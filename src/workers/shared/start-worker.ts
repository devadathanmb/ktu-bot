import { Hono } from "hono";
import {
  setupHealthCheckEndpoint,
  setupMetricsEndpoint,
  createMonitoringServer,
} from "../../monitoring/index.js";
import { setupGracefulShutdown } from "./shutdown.js";
import type { BaseWorker } from "../base/base-worker.js";
import type { Queue } from "bullmq";
import logger from "../../utils/logger.js";

interface StartWorkerConfig<T> {
  WorkerClass: new () => BaseWorker<T>;
  queue: Queue<T>;
  serviceName: string;
  port: number;
}

export async function startWorkerService<T>(config: StartWorkerConfig<T>) {
  try {
    const worker = new config.WorkerClass();
    await worker.start();

    const monitoringApp = new Hono();

    setupHealthCheckEndpoint(monitoringApp, config.serviceName, () =>
      worker.getStatus()
    );

    setupMetricsEndpoint(monitoringApp, config.queue);

    createMonitoringServer(monitoringApp, {
      serviceName: config.serviceName,
      port: config.port,
    });

    setupGracefulShutdown(worker);

    logger.info(`${config.serviceName} worker service started`);
  } catch (error) {
    logger.error(error, `Failed to start ${config.serviceName} worker service`);
    process.exit(1);
  }
}
