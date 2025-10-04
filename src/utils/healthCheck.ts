import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { checkDatabaseHealth } from "../db/healthCheck.js";
import logger from "./logger.js";

export interface HealthCheckResult {
  status: "ok" | "error";
  timestamp: string;
  service: string;
  isDbHealthy: boolean;
  isRunning: boolean;
}

export function createHealthCheckResponse(
  serviceName: string,
  isRunning: boolean,
  isDatabaseHealthy: boolean
): HealthCheckResult {
  const isHealthy = isRunning && isDatabaseHealthy;

  return {
    status: isHealthy ? "ok" : "error",
    timestamp: new Date().toISOString(),
    service: serviceName,
    isDbHealthy: isDatabaseHealthy,
    isRunning: isRunning,
  };
}

// Helper function to setup a health check server
export function setupHealthCheckServer(
  serviceName: string,
  port: number,
  getServiceHealth: () => boolean | Promise<boolean>
) {
  const app = new Hono();

  app.get("/health", async c => {
    logger.debug(`Health check request received: ${c.req.url}`);
    const isRunning = await getServiceHealth();
    const isDbHealthy = await checkDatabaseHealth();
    const result = createHealthCheckResponse(
      serviceName,
      isRunning,
      isDbHealthy
    );
    return c.json(result, result.status === "ok" ? 200 : 503);
  });

  app.get("/", c => c.redirect("/health"));

  serve({ fetch: app.fetch, port }, info => {
    logger.info(
      `🌐 ${serviceName} healthcheck server listening on port ${info.port}`
    );
  });
}
