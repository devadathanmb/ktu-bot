import { BotError } from "grammy";
import { replyMessageSafely } from "../../utils/bot.js";
import { emoji } from "@grammyjs/emoji";
import logger from "../../utils/logger.js";
import { HandledBotError } from "../../errors/HandledBotError.js";
import type { BotMetrics } from "../../metrics/definitions.js";

/**
 * Global error handler for the bot
 * Catches all errors that bubble up from middleware and composers
 * Tracks all errors centrally for metrics, but only responds to user if error wasn't already handled
 */
export const globalErrorHandler = async (
  error: BotError,
  metrics?: BotMetrics
) => {
  const ctx = error.ctx;
  const actualError = error.error;

  // Track ALL errors centrally in metrics (handled or not)
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

  // Check if error was already handled by an error boundary
  if (actualError instanceof HandledBotError) {
    // Error was handled at boundary level - user already notified
    logger.info(
      {
        originalError: actualError.originalError.message,
        originalErrorType: actualError.originalError.constructor.name,
        handledBy: actualError.handledBy,
        cleanupActions: actualError.cleanupActions,
        userNotified: actualError.userNotified,
      },
      "Error already handled by boundary"
    );

    // Don't send duplicate message to user
    return;
  }

  // Unhandled error - log with full context and notify user
  logger.error(error, "Unhandled error in global handler");

  await replyMessageSafely(
    ctx,
    `${emoji("warning")} Oops! Something went wrong on my end. Please try again later.`
  );
};
