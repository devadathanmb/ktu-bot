import type { Hono } from "hono";
import { checkDatabaseHealth } from "../db/health-check.js";
import logger from "../utils/logger.js";

export interface HealthCheckResult {
  status: "ok" | "error";
  timestamp: string;
  service: string;
  isDbHealthy: boolean;
  isRunning: boolean;
}

/**
 * Creates a standardized health check response
 *
 * @param serviceName - Name of the service being checked
 * @param isRunning - Whether the service is running
 * @param isDatabaseHealthy - Whether the database connection is healthy
 * @returns Standardized health check result
 */
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

/**
 * Adds a /health endpoint to the provided Hono app
 * Pure utility with no coupling to metrics or other concerns
 *
 * @param app - Hono application instance
 * @param serviceName - Name of the service
 * @param getServiceHealth - Function that returns whether the service is healthy
 */
export function setupHealthCheckEndpoint(
  app: Hono,
  serviceName: string,
  getServiceHealth: () => boolean | Promise<boolean>
): void {
  app.get("/health", async c => {
    const userAgent = c.req.header("User-Agent");

    // Skip logging for uptime monitoring services
    if (userAgent && !userAgent.toLowerCase().includes("uptime")) {
      logger.debug(`Health check request received: ${c.req.url}`);
    }

    const isRunning = await getServiceHealth();
    const isDbHealthy = await checkDatabaseHealth();
    const result = createHealthCheckResponse(
      serviceName,
      isRunning,
      isDbHealthy
    );
    return c.json(result, result.status === "ok" ? 200 : 503);
  });
}
