import { Bot } from "grammy";
import { BotConfig } from "../../configs/bot.js";
import { BotContext } from "../../types/bot.types.js";
import { GrammyError } from "grammy";
import logger from "../../utils/logger.js";

export function createWorkerBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(BotConfig.BOT_TOKEN);

  bot.catch(error => {
    if (error instanceof GrammyError) {
      logger.error({ err: error }, "Telegram API error");
      return;
    }

    logger.error({ err: error as Error }, "Unexpected bot error");
  });

  return bot;
}
