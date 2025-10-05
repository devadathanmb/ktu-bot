import { BotError } from "grammy";
import { replyMessageSafely } from "../../utils/bot.js";
import { emoji } from "@grammyjs/emoji";
import logger from "../../utils/logger.js";

// This is the global error handler for the bot
// Any middleware can have a .catch() associated with it to handle errors in the middleware boundary
// If not, the errors are propagated to the global error handler
// This is essential to see what's going wrong in the bot and handle unexpected errors gracefully
export const globalErrorHandler = async (error: BotError) => {
  logger.error(error, "Global error handler caught an error");
  await replyMessageSafely(
    error.ctx,
    `${emoji("warning")} Oops! Something went wrong on my end. Please try again later.`
  );
};
