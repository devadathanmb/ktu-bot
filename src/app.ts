import createBot from "./createBot";
import notifyUserCron from "./cron/notifyUserCron";

// Create the bot and initialize the database
const { bot, db } = createBot();

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
        notifyUserCron(db, bot);
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
        notifyUserCron(db, bot);
      });
  }
};

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

launchBot();
