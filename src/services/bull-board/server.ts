import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createBullBoard } from "@bull-board/api";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { queueAdapters } from "../../workers/shared/queue-registry.js";
import { BullBoardServiceConfig } from "../../configs/bull-board-service.js";
import logger from "../../utils/logger.js";

function startBullBoard() {
  try {
    const app = new Hono();

    // Setup Bull Board with Hono adapter
    const serverAdapter = new HonoAdapter(serveStatic);
    serverAdapter.setBasePath("/");

    createBullBoard({
      queues: queueAdapters,
      serverAdapter,
      options: {
        uiConfig: {
          boardTitle: "KTU Bot - Queue Monitor",
          miscLinks: [
            { text: "GitHub", url: "https://github.com/devadathanmb/ktu-bot" },
          ],
        },
      },
    });

    // Request logging middleware for Bull Board routes
    app.use("/*", async (c, next) => {
      logger.info(
        { method: c.req.method, path: c.req.path },
        "Bull Board request"
      );
      await next();
    });

    // Mount Bull Board routes
    app.route("/", serverAdapter.registerPlugin());

    // Health check endpoint for the monitoring service itself
    app.get("/health", c => {
      return c.json({
        status: "ok",
        service: "bull-board-monitor",
        timestamp: new Date().toISOString(),
        queues: queueAdapters.length,
      });
    });

    // Start server
    serve({ fetch: app.fetch, port: BullBoardServiceConfig.PORT }, info => {
      logger.info(
        { port: info.port, queues: queueAdapters.length },
        "Bull Board monitoring dashboard running"
      );
    });
  } catch (error) {
    logger.error(error, "Failed to start Bull Board monitoring service");
    process.exit(1);
  }
}

void startBullBoard();
