import bot from "@/bot";
import start from "@handlers/start";
import defaultHandler from "@handlers/defaultHandler";
import filterCallbackHandler from "@handlers/filterCallbackHandler";
import {
  inlineQueryResultHandler,
  searchInlineQueryHandler,
} from "@handlers/searchInlineQueryHandler";

function attachListeners() {
  bot.start(start);
  bot.action(/filter_*/, filterCallbackHandler);
  bot.on("inline_query", searchInlineQueryHandler);
  bot.on("chosen_inline_result", inlineQueryResultHandler);
  bot.on("message", defaultHandler);
}

export default attachListeners;
