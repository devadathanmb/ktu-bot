import initBot from "@/bot/initBot";
import notifyUserCron from "cron/notifyUserCron";
import queue from "queues/notiyUserQueue/queue";
import bot from "@/bot";
import Logger from "./utils/logger";

const logger = Logger.getLogger("TELEGRAF");

const launchBot = async () => {
  // Launch in long polling mode if in development
  if (process.env.ENV_TYPE === "DEVELOPMENT") {
    bot.launch(
      {
        dropPendingUpdates: true,
      },
      () => {
        if (bot)
          bot.telegram.getMe().then((res) => {
            logger.info(
              `Bot started in polling mode. Available at https://t.me/${res.username}`
            );
            notifyUserCron();
          });
      }
    );
  }
  // Launch in webhook mode if in production
  else {
    bot.launch(
      {
        webhook: {
          domain: process.env.WEBHOOK_DOMAIN!,
          port: Number(process.env.WEBHOOK_PORT),
          maxConnections: 100,
        },
        dropPendingUpdates: true,
      },
      () => {
        if (bot)
          bot.telegram.getMe().then((res) => {
            logger.info(
              `Bot started in webhook mode. Available at https://t.me/${res.username}`
            );
            notifyUserCron();
          });
      }
    );
  }
};

// Graceful stop
process.once("SIGINT", async () => {
  logger.warn("SIGINT received. Stopping bot.");
  bot.stop("SIGINT");
  await queue.obliterate({ force: true });
});

process.once("SIGTERM", async () => {
  logger.warn("SIGTERM received. Stopping bot.");
  bot.stop("SIGTERM");
  await queue.obliterate({ force: true });
});

// Create the bot by initializing all handlers
initBot();

//Launch the bot
launchBot();
