import { Bot } from "grammy";
import { BotConfig } from "../../configs/bot.js";
import { BotContext } from "../../types/bot.types.js";
import { GrammyError } from "grammy";
import logger from "../../utils/logger.js";

export function createWorkerBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(BotConfig.BOT_TOKEN);

  bot.catch(error => {
    if (error instanceof GrammyError) {
      logger.error(
        {
          error_code: error.error_code,
          description: error.description,
        },
        "Worker bot API error"
      );
    } else {
      logger.error(error, "Worker bot error");
    }
  });

  return bot;
}
