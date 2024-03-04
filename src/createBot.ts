import bot from "@/bot";
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
  bot.command("help", help);
  bot.command("search", search);
  bot.command("result", result);
  bot.command("code", code);
  bot.command("cancel", cancel);
  bot.command("notifications", notifications);
  bot.command("subscribe", subscribe);
  bot.command("unsubscribe", unsubscribe);
  bot.command("timetable", timetable);
  bot.command("calendar", calendar);
  bot.command("changefilter", changeFilter);
}

// Attach all other event listeners to the bot
function attachListeners() {
  bot.start(start);
  bot.action(/filter_*/, filterCallbackHandler);
  bot.on("inline_query", searchInlineQueryHandler);
  bot.on("chosen_inline_result", inlineQueryResultHandler);
  bot.on("message", defaultHandler);
}

// Attach all commands, middlewares and listeners to the bot
function createBot() {
  setCommands();
  attachMiddlewares();
  attachCommands();
  attachListeners();
}

export default createBot;
