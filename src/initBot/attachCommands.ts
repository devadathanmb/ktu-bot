import bot from "@/bot";
import help from "handlers/commands/help";
import cancel from "handlers/commands/cancel";
import result from "handlers/commands/result";
import calendar from "handlers/commands/calendar";
import search from "handlers/commands/search";
import code from "handlers/commands/code";
import changeFilter from "handlers/commands/changeFilter";
import notifications from "handlers/commands/notifications";
import subscribe from "handlers/commands/subscribe";
import unsubscribe from "handlers/commands/unsubscribe";
import timetable from "handlers/commands/timetable";
import page from "handlers/commands/page";
import oldResults from "handlers/commands/oldResults";
import apiStatus from "handlers/commands/apiStatus";
import logger from "@/utils/logger";

// Attach all command handlers/commands to the bot
function attachCommands() {
  logger.info("Attaching commands");
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
  bot.command("page", page);
  bot.command("pageinfo", page);
  bot.command("oldresults", oldResults);
  bot.command("serverstatus", apiStatus);
}

export default attachCommands;
