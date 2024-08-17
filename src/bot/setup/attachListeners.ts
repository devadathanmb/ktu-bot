import bot from "@/bot/bot";
import start from "handlers/start";
import defaultHandler from "handlers/defaultHandler";
import filterCallbackHandler from "handlers/callbackQuerys/filterCallbackHandler";
import startCallbackHandler from "handlers/callbackQuerys/startCallbackHandler";

import {
  inlineQueryResultHandler,
  searchInlineQueryHandler,
} from "handlers/searchInlineQueryHandler";

function attachListeners() {
  bot.start(start);
  bot.action(/filter_*/, filterCallbackHandler);
  bot.action(/start_callback_*/, startCallbackHandler);
  bot.on("inline_query", searchInlineQueryHandler);
  bot.on("chosen_inline_result", inlineQueryResultHandler);
  bot.on("message", defaultHandler);
  bot.on("callback_query", defaultHandler);
}

export default attachListeners;
