import { Telegraf } from "telegraf";
import "dotenv/config";
import start from "./handlers/start";
import help from "./handlers/help";
import cancel from "./handlers/cancel";
import result from "./handlers/result";
import calendar from "./handlers/calendar";
import search from "./handlers/search";
import code from "./handlers/code";
import notifications from "./handlers/notifications";
import subscribe from "./handlers/subscribe";
import unsubscribe from "./handlers/unsubscribe";
import defaultHandler from "./handlers/defaultHandler";
import { Scenes, session } from "telegraf";
import resultWizard from "./scenes/resultWizard";
import academicCalendarWizard from "./scenes/calendarWizard";
import announcementWizard from "./scenes/announcementWizard";
import { CustomContext } from "./types/customContext.type";
import availableCommands from "./constants/availableCommands";
import { initDb } from "./db/initDb";
import loggingMiddleware from "./middlewares/loggingMiddleware";
import notifyUserCron from "./cron/notifyUserCron";
import {
  inlineQueryResultHandler,
  searchInlineQueryHandler,
} from "./handlers/searchInlineQueryHandler";

const db = initDb();

const bot = new Telegraf<CustomContext>(process.env.BOT_TOKEN!);
const stage = new Scenes.Stage<CustomContext>([
  resultWizard,
  announcementWizard,
  academicCalendarWizard,
]);

bot.use(loggingMiddleware);
bot.use(session());
bot.use(stage.middleware());

bot.telegram.setMyCommands(availableCommands);

bot.start(async (ctx) => await start(ctx));
bot.command("help", async (ctx) => await help(ctx));
bot.command("search", async (ctx) => await search(ctx));
bot.command("result", async (ctx) => await result(ctx));
bot.command("code", async (ctx) => await code(ctx));
bot.command("cancel", async (ctx) => await cancel(ctx));
bot.command("notifications", async (ctx) => await notifications(ctx));
bot.command("subscribe", async (ctx) => await subscribe(ctx, db));
bot.command("unsubscribe", async (ctx) => await unsubscribe(ctx, db));
bot.command("calendar", async (ctx) => await calendar(ctx));
bot.on("inline_query", async (ctx) => await searchInlineQueryHandler(ctx));
bot.on("chosen_inline_result", async (ctx) => {
  await inlineQueryResultHandler(ctx.chosenInlineResult, bot);
});
bot.on("message", async (ctx) => await defaultHandler(ctx));

// The top level error handler
// this will catch any errors that may happen
bot.catch((error) => {
  console.log("telegraf error", error);
});

const launchBot = async () => {
  if (process.env.ENV_TYPE === "DEVELOPMENT") {
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
