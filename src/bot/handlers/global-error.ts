import { BotError } from "grammy";
import { replyMessageSafely } from "../../utils/bot.js";
import { emoji } from "@grammyjs/emoji";
import logger from "../../utils/logger.js";
import { HandledBotError } from "../../errors/handled-bot-error.js";
import type { BotMetrics } from "../../metrics/definitions.js";

export const globalErrorHandler = async (
  error: BotError,
  metrics?: BotMetrics
) => {
  const ctx = error.ctx;
  const actualError = error.error;

  if (metrics) {
    let errorType: string;
    let handledBy: string;

    if (actualError instanceof HandledBotError) {
      errorType = actualError.originalError.constructor.name;
      handledBy = actualError.handledBy;
    } else if (actualError instanceof Error) {
      errorType = actualError.constructor.name;
      handledBy = "global";
    } else {
      errorType = "Unknown";
      handledBy = "global";
    }

    metrics.botErrorsTotal.inc({
      error_type: errorType,
      handled_by: handledBy,
    });
  }

  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;

  if (actualError instanceof HandledBotError) {
    // Error was handled at boundary level - user already notified
    logger.info(
      {
        err: actualError.originalError,
        handledBy: actualError.handledBy,
        cleanupActions: actualError.cleanupActions,
        userNotified: actualError.userNotified,
        chatId,
        userId,
      },
      "Error already handled by boundary"
    );

    return;
  }

  logger.error(
    { err: actualError, chatId, userId },
    "Unhandled error in global handler"
  );

  await replyMessageSafely(
    ctx,
    `${emoji("warning")} Oops! Something went wrong on my end. Please try again later.`
  );
};
