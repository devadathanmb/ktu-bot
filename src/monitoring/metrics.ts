import type { Hono } from "hono";
import type { Registry } from "prom-client";
import type { Queue } from "bullmq";
import logger from "../utils/logger.js";

function isRegistry(source: Registry | Queue): source is Registry {
  return "metrics" in source && typeof source.metrics === "function";
}

export function setupMetricsEndpoint(
  app: Hono,
  source: Registry | Queue
): void {
  app.get("/metrics", async c => {
    try {
      const metrics = isRegistry(source)
        ? await source.metrics()
        : await source.exportPrometheusMetrics();

      const contentType = isRegistry(source)
        ? source.contentType
        : "text/plain; version=0.0.4";

      c.header("Content-Type", contentType);
      return c.text(metrics);
    } catch (error) {
      logger.error({ err: error }, "Failed to collect metrics");
      return c.text("Error collecting metrics", 500);
    }
  });

  logger.info("Metrics endpoint configured at /metrics");
}
