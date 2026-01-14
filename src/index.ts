import logger from "./utils/logger.js";
import { botCommands } from "./bot/commands/index.js";
import { initDB, closeDB } from "./db/connection.js";
import { createBotWithMetrics } from "./bot/bot.js";
import { run, RunnerHandle } from "@grammyjs/runner";
import { BotConfig } from "./configs/bot.js";
import { Hono } from "hono";
import {
  setupHealthCheckEndpoint,
  setupMetricsEndpoint,
  createMonitoringServer,
} from "./monitoring/index.js";
import { createMetricsRegistry } from "./metrics/registry.js";
import { createBotMetrics } from "./metrics/definitions.js";

async function startBotInLongPolling() {
  try {
    // Initialize the DB connection before starting the bot
    await initDB();

    // Initialize Prometheus metrics
    const metricsRegistry = createMetricsRegistry("ktu-bot-app", {
      enableDefaultMetrics: false,
    });
    const botMetrics = createBotMetrics(metricsRegistry);

    // Create bot instance with metrics
    const bot = createBotWithMetrics(botMetrics);

    // Set bot commands
    await botCommands.setCommands(bot);

    // Delete webhook since this is long polling
    await bot.api.deleteWebhook({ drop_pending_updates: false });

    // Create runner
    const runner = run(bot);

    // Create monitoring server with health check and metrics endpoints
    const monitoringApp = new Hono();

    // Add health check endpoint
    setupHealthCheckEndpoint(
      monitoringApp,
      "bot",
      async () =>
        runner.isRunning() &&
        (await bot.api
          .getMe()
          .then(() => true)
          .catch(() => false))
    );

    // Add metrics endpoint
    setupMetricsEndpoint(monitoringApp, metricsRegistry);

    // Start monitoring server
    createMonitoringServer(monitoringApp, {
      serviceName: "bot",
      port: BotConfig.BOT_HEALTH_CHECK_PORT,
    });

    logger.info("🚀 KTU Bot started successfully");

    // Graceful shutdown handling
    process.on("SIGINT", () => void onShutdown(runner, "SIGINT"));
    process.on("SIGTERM", () => void onShutdown(runner, "SIGTERM"));
  } catch (error) {
    logger.error(error, "Failed to start bot");
    await onShutdown();
  }
}

// Graceful shutdown function
async function onShutdown(runner?: RunnerHandle, signal?: string) {
  if (signal) {
    logger.info(`Received ${signal}, shutting down gracefully`);
  }
  if (runner) {
    await runner.stop();
  }
  await closeDB();
  process.exit(signal ? 0 : 1);
}

// Start the bot application
await startBotInLongPolling();
