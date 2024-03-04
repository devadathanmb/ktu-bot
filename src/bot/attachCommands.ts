import bot from "@/bot";
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

export default attachCommands;
