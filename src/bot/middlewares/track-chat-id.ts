import { withTransaction } from "../../db/index.js";
import { BotContext } from "../../types/bot.types.js";
import { NextFunction } from "grammy";
import { ChatRepository } from "../../db/index.js";

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
