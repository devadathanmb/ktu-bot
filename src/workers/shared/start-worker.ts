import { Hono } from "hono";
import {
  setupHealthCheckEndpoint,
  setupMetricsEndpoint,
  createMonitoringServer as createProductionMonitoringServer,
} from "../../monitoring/index.js";
import type {
  MonitoringServer,
  MonitoringServerOptions,
} from "../../monitoring/index.js";
import { setupGracefulShutdown as setupProductionGracefulShutdown } from "./shutdown.js";
import type { Queue } from "bullmq";
import logger from "../../utils/logger.js";
import type { WorkerControl } from "./worker-runtime.js";
import { createWorkerShutdown } from "./worker-shutdown.js";

interface StartWorkerMonitoringConfig<T> {
  worker: WorkerControl;
  queue: Queue<T>;
  serviceName: string;
  port: number;
  closeDB: () => Promise<void>;
}

export interface StartWorkerMonitoringDeps {
  createMonitoringServer: (
    app: Hono,
    options: MonitoringServerOptions
  ) => MonitoringServer;
  setupGracefulShutdown: (stop: () => Promise<void>) => void;
}

const productionDeps: StartWorkerMonitoringDeps = {
  createMonitoringServer: createProductionMonitoringServer,
  setupGracefulShutdown: setupProductionGracefulShutdown,
};

export function startWorkerMonitoring<T>(
  config: StartWorkerMonitoringConfig<T>,
  deps: StartWorkerMonitoringDeps = productionDeps
): void {
  const monitoringApp = new Hono();

  setupHealthCheckEndpoint(monitoringApp, config.serviceName, () =>
    config.worker.getStatus()
  );

  setupMetricsEndpoint(monitoringApp, config.queue);

  const monitoringServer = deps.createMonitoringServer(monitoringApp, {
    serviceName: config.serviceName,
    port: config.port,
  });

  deps.setupGracefulShutdown(
    createWorkerShutdown(config.worker, {
      closeDB: config.closeDB,
      closeMonitoringServer: () => monitoringServer.close(),
    })
  );

  logger.info(
    { serviceName: config.serviceName, queueName: config.queue.name },
    "Worker service started"
  );
}
