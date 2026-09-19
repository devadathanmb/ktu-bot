import { Hono } from "hono";
import {
  setupHealthCheckEndpoint,
  setupMetricsEndpoint,
  createMonitoringServer,
} from "../../monitoring/index.js";
import { setupGracefulShutdown } from "./shutdown.js";
import type { Queue } from "bullmq";
import logger from "../../utils/logger.js";
import type { WorkerControl } from "./worker-runtime.js";

interface StartWorkerMonitoringConfig<T> {
  worker: WorkerControl;
  queue: Queue<T>;
  serviceName: string;
  port: number;
  stop: () => Promise<void>;
}

export function startWorkerMonitoring<T>(
  config: StartWorkerMonitoringConfig<T>
): void {
  const monitoringApp = new Hono();

  setupHealthCheckEndpoint(monitoringApp, config.serviceName, () =>
    config.worker.getStatus()
  );

  setupMetricsEndpoint(monitoringApp, config.queue);

  createMonitoringServer(monitoringApp, {
    serviceName: config.serviceName,
    port: config.port,
  });

  setupGracefulShutdown(config.stop);
  logger.info(
    { serviceName: config.serviceName, queueName: config.queue.name },
    "Worker service started"
  );
}
