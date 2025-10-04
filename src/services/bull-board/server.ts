import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createBullBoard } from "@bull-board/api";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { queueAdapters } from "../../workers/shared/queueRegistry.js";
import { BullBoardServiceConfig } from "../../configs/bullBoardService.js";
import logger from "../../utils/logger.js";

async function startBullBoard() {
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
      logger.info(`Bull Board request: ${c.req.method} ${c.req.path}`);
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
        `🎯 Bull Board monitoring dashboard running on http://localhost:${info.port}`
      );
      logger.info(`Monitoring ${queueAdapters.length} queue(s)`);
    });
  } catch (error) {
    logger.error(error, "Failed to start Bull Board monitoring service");
    process.exit(1);
  }
}

startBullBoard();
