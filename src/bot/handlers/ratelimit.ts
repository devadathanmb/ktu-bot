import { fmt } from "@grammyjs/parse-mode";
import { BotContext } from "../../types/bot.types.js";
import { joinWithNewlines } from "../../utils/formatting.js";
import logger from "../../utils/logger.js";
import { emoji } from "@grammyjs/emoji";

export const rateLimitExceededHandler = async (ctx: BotContext) => {
  logger.warn({ chatId: ctx.chat?.id }, "Rate limit exceeded");
  const replyMessage = joinWithNewlines(
    [
      fmt`Kure aayi ketto! Ini poyi oru chaaya kudichitu vaa!"`,
      fmt`Please slow down a bit. You have been rate limited ${emoji("turtle")}`,
    ],
    2
  );
  await ctx.reply(replyMessage.text);
};
