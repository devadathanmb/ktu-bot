import { withTransaction } from "../../db/index.js";
import { BotContext } from "../../types/bot.types.js";
import { NextFunction } from "grammy";
import { ChatRepository } from "../../db/index.js";

// This is a middleware to track chat IDs for users who may have already interacted with the bot
// But their chat ID is not yet in the database
async function trackChatId(ctx: BotContext, next: NextFunction) {
  const chatId = ctx.chatId;
  if (chatId) {
    await withTransaction(async tx => {
      const chatRepo = new ChatRepository(tx);
      await chatRepo.createIfNotExists(chatId);
    });
  }
  await next();
}

export default trackChatId;
