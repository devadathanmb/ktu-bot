import type { Hono } from "hono";
import type { Registry } from "prom-client";
import type { Queue } from "bullmq";
import logger from "../utils/logger.js";

/**
 * Type guard to check if source is a Prometheus Registry
 */
function isRegistry(source: Registry | Queue): source is Registry {
  return "metrics" in source && typeof source.metrics === "function";
}

/**
 * Adds a /metrics endpoint to the provided Hono app for Prometheus scraping
 * Pure utility with no coupling to health checks or other concerns
 *
 * @param app - Hono application instance
 * @param source - Either a Prometheus Registry (for custom metrics) or a BullMQ Queue (for queue metrics)
 */
export function setupMetricsEndpoint(
  app: Hono,
  source: Registry | Queue
): void {
  app.get("/metrics", async c => {
    try {
      // Collect metrics based on source type
      const metrics = isRegistry(source)
        ? await source.metrics()
        : await source.exportPrometheusMetrics();

      // Set appropriate content type
      const contentType = isRegistry(source)
        ? source.contentType
        : "text/plain; version=0.0.4";

      c.header("Content-Type", contentType);
      return c.text(metrics);
    } catch (error) {
      logger.error(error, "Failed to collect metrics");
      return c.text("Error collecting metrics", 500);
    }
  });

  logger.info("Metrics endpoint configured at /metrics");
}
