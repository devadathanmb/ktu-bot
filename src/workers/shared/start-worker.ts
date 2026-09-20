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

/**
 * Starts a worker service with its monitoring server and graceful shutdown
 * wiring. Production callers get the production dependencies here; tests use
 * `startWorkerMonitoringWithDeps` to inject fakes.
 */
export function startWorkerMonitoring<T>(
  config: StartWorkerMonitoringConfig<T>
): void {
  startWorkerMonitoringWithDeps(config, {
    createMonitoringServer: createProductionMonitoringServer,
    setupGracefulShutdown: setupProductionGracefulShutdown,
  });
}

/**
 * Core implementation requiring explicit dependencies.
 */
export function startWorkerMonitoringWithDeps<T>(
  config: StartWorkerMonitoringConfig<T>,
  deps: StartWorkerMonitoringDeps
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
      closeMonitoringServer: () => monitoringServer.close(),
      closeDB: config.closeDB,
    })
  );

  logger.info(
    { serviceName: config.serviceName, queueName: config.queue.name },
    "Worker service started"
  );
}
