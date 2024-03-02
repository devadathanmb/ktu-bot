import createBot from "./createBot";
import notifyUserCron from "@/cron/notifyUserCron";
import queue from "@queues/notiyUserQueue/queue";
import bot from "./bot";

createBot();
// Launch the bot
const launchBot = async () => {
  // Launch in long polling mode if in development
  if (process.env.ENV_TYPE === "DEVELOPMENT") {
    bot.launch();
    if (bot)
      bot.telegram.getMe().then((res) => {
        console.log(
          `Bot started in polling mode. Available at https://t.me/${res.username}`
        );
        notifyUserCron();
      });
  }
  // Launch in webhook mode if in production
  else {
    bot.launch({
      webhook: {
        domain: process.env.WEBHOOK_DOMAIN!,
        port: Number(process.env.WEBHOOK_PORT),
      },
    });
    if (bot)
      bot.telegram.getMe().then((res) => {
        console.log(
          `Bot started in webhook mode. Available at https://t.me/${res.username}`
        );
        notifyUserCron();
      });
  }
};

// Graceful stop
process.once("SIGINT", async () => {
  bot.stop("SIGINT");
  await queue.obliterate({ force: true });
});
process.once("SIGTERM", async () => {
  bot.stop("SIGTERM");
  await queue.obliterate({ force: true });
});

launchBot();
