import { ChatIdNotFoundError } from "../../errors/BotErrors.js";
import { BotContext } from "../../types/bot.types.js";
import { NextFunction } from "grammy";

// Simple wrapper middleware to ensure chatId is present in the context
// This is useful for composers that we know will have chatId but want to validate it
async function ensureChatId(ctx: BotContext, next: NextFunction) {
  const chatId = ctx.chatId;
  if (!chatId) throw new ChatIdNotFoundError();
  return next();
}

export default ensureChatId;
