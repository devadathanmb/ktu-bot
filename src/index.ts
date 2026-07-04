import logger from "./utils/logger.js";
import { botCommands } from "./bot/commands/index.js";
import { initDB, closeDB } from "./db/connection.js";
import { createBot, createBotWithMetrics } from "./bot/bot.js";
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
    await initDB();

    let bot;
    let metricsRegistry;

    if (BotConfig.ENABLE_PROMETHEUS_METRICS) {
      metricsRegistry = createMetricsRegistry("ktu-bot-app", {
        enableDefaultMetrics: false,
      });
      const botMetrics = createBotMetrics(metricsRegistry);
      bot = createBotWithMetrics(botMetrics);
      logger.info("Prometheus metrics enabled");
    } else {
      bot = createBot();
      logger.info("Prometheus metrics disabled");
    }

    await botCommands.setCommands(bot);

    await bot.api.deleteWebhook({ drop_pending_updates: false });

    const runner = run(bot, { runner: { silent: true } });
    const runnerTask = runner.task();

    if (runnerTask) {
      void runnerTask.catch(error => {
        logger.error({ err: error }, "Bot runner stopped unexpectedly");
        void onShutdown();
      });
    }

    const monitoringApp = new Hono();

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

    if (metricsRegistry) {
      setupMetricsEndpoint(monitoringApp, metricsRegistry);
    }

    createMonitoringServer(monitoringApp, {
      serviceName: "bot",
      port: BotConfig.BOT_HEALTH_CHECK_PORT,
    });

    logger.info("🚀 KTU Bot started successfully");

    process.on("SIGINT", () => void onShutdown(runner, "SIGINT"));
    process.on("SIGTERM", () => void onShutdown(runner, "SIGTERM"));
  } catch (error) {
    logger.error(error, "Failed to start bot");
    await onShutdown();
  }
}

async function onShutdown(runner?: RunnerHandle, signal?: string) {
  if (signal) {
    logger.info({ signal }, "Shutting down gracefully");
  }
  if (runner) {
    await runner.stop();
  }
  await closeDB();
  process.exit(signal ? 0 : 1);
}

await startBotInLongPolling();
