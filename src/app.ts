import { Telegraf } from "telegraf";
import "dotenv/config";
import start from "./commands/start";
import help from "./commands/help";
import cancel from "./commands/cancel";
import result from "./commands/result";
import code from "./commands/code";
import notifications from "./commands/notifications";
import subscribe from "./commands/subscribe";
import unsubscribe from "./commands/unsubscribe";
import defaultHandler from "./commands/defaultHandler";
import { Scenes, session } from "telegraf";
import resultWizard from "./scenes/resultWizard";
import announcementWizard from "./scenes/announcementWizard";
import { CustomContext } from "./types/customContext.type";
import availableCommands from "./constants/availableCommands";
import { initDb } from "./db/initDb";
import loggingMiddleware from "./middlewares/loggingMiddleware";
import notifyUserCron from "./cron/notifyUserCron";

const db = initDb();

const bot = new Telegraf<CustomContext>(process.env.BOT_TOKEN!);
const stage = new Scenes.Stage<CustomContext>([
  resultWizard,
  announcementWizard,
]);

bot.use(loggingMiddleware);
bot.use(session());
bot.use(stage.middleware());

bot.telegram.setMyCommands(availableCommands);

bot.start(async (ctx) => await start(ctx));
bot.command("help", async (ctx) => await help(ctx));
bot.command("result", async (ctx) => await result(ctx));
bot.command("code", async (ctx) => await code(ctx));
bot.command("cancel", async (ctx) => await cancel(ctx));
bot.command("notifications", async (ctx) => await notifications(ctx));
bot.command("subscribe", async (ctx) => await subscribe(ctx, db));
bot.command("unsubscribe", async (ctx) => await unsubscribe(ctx, db));
bot.on("message", async (ctx) => await defaultHandler(ctx));

bot.catch((error) => {
  console.log("telegraf error", error);
});

const launchBot = async () => {
  if (process.env.ENY_TYPE === "DEVELOPMENT") {
    bot.launch();
    if (bot)
      bot.telegram.getMe().then((res) => {
        console.log(
          `Bot started in polling mode. Available at https://t.me/${res.username}`,
        );
        notifyUserCron(db, bot);
      });
  } else {
    bot.launch({
      webhook: {
        domain: process.env.WEBHOOK_DOMAIN!,
        port: Number(process.env.WEBHOOK_PORT),
      },
    });
    if (bot)
      bot.telegram.getMe().then((res) => {
        console.log(
          `Bot started in webhook mode. Available at https://t.me/${res.username}`,
        );
        notifyUserCron(db, bot);
      });
  }
};

launchBot();

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
