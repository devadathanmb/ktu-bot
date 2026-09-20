import type { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import logger from "../utils/logger.js";

export interface MonitoringServerOptions {
  serviceName: string;
  port: number;
}

/**
 * Narrow handle for a running monitoring server. Closing is idempotent and
 * propagates the underlying server close error to the caller.
 */
export interface MonitoringServer {
  close(): Promise<void>;
}

/**
 * Narrow seam for starting the HTTP server. Production passes the
 * `@hono/node-server` `serve` implementation; tests inject a fake.
 */
type ServerStarter = typeof serve;

/**
 * Creates and starts a monitoring server with the provided Hono app
 * The app should have endpoints configured via setupHealthCheckEndpoint, setupMetricsEndpoint, etc.
 *
 * @param app - Hono application with configured endpoints
 * @param options - Server configuration options
 * @param startServer - Server starter, defaults to `serve` from `@hono/node-server`
 */
export function createMonitoringServer(
  app: Hono,
  options: MonitoringServerOptions,
  startServer: ServerStarter = serve
): MonitoringServer {
  const { serviceName, port } = options;

  // Add root redirect to /health by default
  app.get("/", c => c.redirect("/health"));

  const server: ServerType = startServer({ fetch: app.fetch, port }, info => {
    logger.info(
      { serviceName, port: info.port },
      "Monitoring server listening"
    );
  });

  let closePromise: Promise<void> | undefined;

  return {
    close(): Promise<void> {
      closePromise ??= new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      return closePromise;
    },
  };
}
