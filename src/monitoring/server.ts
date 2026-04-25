import type { Hono } from "hono";
import { serve } from "@hono/node-server";
import logger from "../utils/logger.js";

export interface MonitoringServerOptions {
  serviceName: string;
  port: number;
}

/**
 * Creates and starts a monitoring server with the provided Hono app
 * The app should have endpoints configured via setupHealthCheckEndpoint, setupMetricsEndpoint, etc.
 *
 * @param app - Hono application with configured endpoints
 * @param options - Server configuration options
 */
export function createMonitoringServer(
  app: Hono,
  options: MonitoringServerOptions
): void {
  const { serviceName, port } = options;

  // Add root redirect to /health by default
  app.get("/", c => c.redirect("/health"));

  serve({ fetch: app.fetch, port }, info => {
    logger.info(
      { serviceName, port: info.port },
      "Monitoring server listening"
    );
  });
}
