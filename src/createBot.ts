import bot from "./bot";
import start from "@handlers/start";
import help from "@handlers/help";
import cancel from "@handlers/cancel";
import result from "@handlers/result";
import calendar from "@handlers/calendar";
import search from "@handlers/search";
import code from "@handlers/code";
import changeFilter from "@handlers/changeFilter";
import notifications from "@handlers/notifications";
import subscribe from "@handlers/subscribe";
import unsubscribe from "@handlers/unsubscribe";
import timetable from "@handlers/timetable";
import defaultHandler from "@handlers/defaultHandler";
import { Scenes, session } from "telegraf";
import resultWizard from "@wizards/resultWizard";
import academicCalendarWizard from "@wizards/calendarWizard";
import announcementWizard from "@wizards/announcementWizard";
import timetableWizard from "@wizards/timeTableWizard";
import { CustomContext } from "@/types/customContext.type";
import availableCommands from "@constants/availableCommands";
import loggingMiddleware from "@middlewares/loggingMiddleware";
import throttler from "@middlewares/throttler";
import {
  inlineQueryResultHandler,
  searchInlineQueryHandler,
} from "@handlers/searchInlineQueryHandler";
import filterCallbackHandler from "@handlers/filterCallbackHandler";

// Attach all middlewares to the bot
function attachMiddlewares() {
  // Create wizard
  const stage = new Scenes.Stage<CustomContext>([
    resultWizard,
    announcementWizard,
    academicCalendarWizard,
    timetableWizard,
  ]);

  // Register middlewares
  bot.use(throttler);
  bot.use(loggingMiddleware);
  bot.use(session());
  bot.use(stage.middleware());
}

// Set the available commands for the bot
function setCommands() {
  bot.telegram.setMyCommands(availableCommands);
}

// Attach all command handlers to the bot
function attachCommands() {
  bot.command("help", async (ctx) => await help(ctx));
  bot.command("search", async (ctx) => await search(ctx));
  bot.command("result", async (ctx) => await result(ctx));
  bot.command("code", async (ctx) => await code(ctx));
  bot.command("cancel", async (ctx) => await cancel(ctx));
  bot.command("notifications", async (ctx) => await notifications(ctx));
  bot.command("subscribe", async (ctx) => await subscribe(ctx));
  bot.command("unsubscribe", async (ctx) => await unsubscribe(ctx));
  bot.command("timetable", async (ctx) => await timetable(ctx));
  bot.command("calendar", async (ctx) => await calendar(ctx));
  bot.command("changefilter", async (ctx) => await changeFilter(ctx));
}

// Attach all other event listeners to the bot
function attachListeners() {
  bot.start(async (ctx) => await start(ctx));
  bot.action(/filter_*/, async (ctx) => await filterCallbackHandler(ctx));
  bot.on("inline_query", async (ctx) => await searchInlineQueryHandler(ctx));
  bot.on("chosen_inline_result", async (ctx) => {
    await inlineQueryResultHandler(ctx.chosenInlineResult, bot);
  });
  bot.on("message", async (ctx) => await defaultHandler(ctx));
}

// Attach all commands, middlewares and listeners to the bot
async function createBot() {
  attachMiddlewares();
  setCommands();
  attachCommands();
  attachListeners();
}

export default createBot;
