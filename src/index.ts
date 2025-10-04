import logger from "./utils/logger.js";
import { botCommands } from "./bot/commands/index.js";
import { initDB, closeDB } from "./db/connection.js";
import { createBot } from "./bot/bot.js";
import { run, RunnerHandle } from "@grammyjs/runner";
import { BotConfig } from "./configs/bot.js";
import { setupHealthCheckServer } from "./utils/healthCheck.js";

async function startBotInLongPolling() {
  try {
    // Initialize the DB connection before starting the bot
    await initDB();

    // Create bot instance
    const bot = createBot();

    // Set bot commands
    await botCommands.setCommands(bot);

    // Delete webhook since this is long polling
    await bot.api.deleteWebhook({ drop_pending_updates: false });

    // Create runner
    const runner = run(bot);

    // Start health check server
    setupHealthCheckServer(
      "bot",
      BotConfig.BOT_HEALTH_CHECK_PORT,
      async () =>
        runner.isRunning() &&
        (await bot.api
          .getMe()
          .then(() => true)
          .catch(() => false))
    );

    logger.info("🚀 KTU Bot started successfully");

    // Graceful shutdown handling
    process.on("SIGINT", () => onShutdown(runner, "SIGINT"));
    process.on("SIGTERM", () => onShutdown(runner, "SIGTERM"));
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
