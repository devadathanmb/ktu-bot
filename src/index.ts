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
import type { MonitoringServer } from "./monitoring/index.js";
import { createMetricsRegistry } from "./metrics/registry.js";
import { createBotMetrics } from "./metrics/definitions.js";
import { attachmentDeliveryQueue } from "./workers/attachment-delivery/queue.js";
import { createBotShutdown } from "./lifecycle.js";

async function startBotInLongPolling() {
  let runner: RunnerHandle | undefined;
  let monitoringServer: MonitoringServer | undefined;

  const shutdown = createBotShutdown({
    closeMonitoringServer: async () => {
      await monitoringServer?.close();
    },
    closeRunner: async () => {
      await runner?.stop();
    },
    closeAttachmentDeliveryQueue: () => attachmentDeliveryQueue.close(),
    closeDB,
    exit: code => process.exit(code),
  });

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

    const botRunner = run(bot, { runner: { silent: true } });
    runner = botRunner;
    const runnerTask = botRunner.task();

    if (runnerTask) {
      void runnerTask.catch(error => {
        logger.error({ err: error }, "Bot runner stopped unexpectedly");
        void shutdown({ type: "failure", source: "runner" });
      });
    }

    const monitoringApp = new Hono();

    setupHealthCheckEndpoint(
      monitoringApp,
      "bot",
      async () =>
        botRunner.isRunning() &&
        (await bot.api
          .getMe()
          .then(() => true)
          .catch(() => false))
    );

    if (metricsRegistry) {
      setupMetricsEndpoint(monitoringApp, metricsRegistry);
    }

    monitoringServer = createMonitoringServer(monitoringApp, {
      serviceName: "bot",
      port: BotConfig.BOT_HEALTH_CHECK_PORT,
    });

    logger.info("🚀 KTU Bot started successfully");

    process.on(
      "SIGINT",
      () => void shutdown({ type: "signal", name: "SIGINT" })
    );
    process.on(
      "SIGTERM",
      () => void shutdown({ type: "signal", name: "SIGTERM" })
    );
  } catch (error) {
    logger.error({ err: error }, "Failed to start bot");
    await shutdown({ type: "failure", source: "startup" });
  }
}

await startBotInLongPolling();
