import { GrammyError } from "grammy";
import { Queue } from "bullmq";
import { AnnouncementSubscriptionRepository } from "../../../db/repositories/announcement-subscription-repository.js";
import { ChatRepository } from "../../../db/repositories/chat-repository.js";
import { withTransaction } from "../../../db/transactions.js";
import { setTimeout } from "node:timers/promises";
import logger from "../../../utils/logger.js";

/**
 * Utility functions for handling common Telegram API errors across workers
 * Extracts duplicated error handling logic to avoid code repetition
 */
export const TelegramErrorUtils = {
  /**
   * Check if error indicates user blocked the bot
   */
  isUserBlockedError(errorCode: number, description: string): boolean {
    return (
      errorCode === 403 ||
      (errorCode === 400 && description.includes("USER_IS_BLOCKED"))
    );
  },

  /**
   * Check if error indicates user deactivated their account
   */
  isUserDeactivatedError(errorCode: number, description: string): boolean {
    return (
      (errorCode === 403 && description.includes("deactivated")) ||
      (errorCode === 400 && description.includes("USER_DEACTIVATED"))
    );
  },

  /**
   * Check if error indicates rate limiting
   */
  isRateLimitError(errorCode: number): boolean {
    return errorCode === 429;
  },

  /**
   * Handle user who blocked the bot
   * Removes subscription and marks chat as kicked
   */
  async handleBlockedUser(chatId: number): Promise<void> {
    await withTransaction(async tx => {
      const subscriptionRepo = new AnnouncementSubscriptionRepository(tx);
      const chatRepo = new ChatRepository(tx);

      await subscriptionRepo.delete(chatId);
      await chatRepo.createIfNotExists(chatId);
      await chatRepo.markKicked(chatId);
    });
  },

  /**
   * Handle user who deactivated their account
   * Removes chat record entirely
   */
  async handleDeactivatedUser(chatId: number): Promise<void> {
    await withTransaction(async tx => {
      const chatRepo = new ChatRepository(tx);
      await chatRepo.delete(chatId);
    });
  },

  /**
   * Handle rate limiting by pausing the queue and resuming after duration
   */
  async handleRateLimitWithQueuePause(
    queue: Queue,
    retryAfterSeconds: number
  ): Promise<void> {
    const duration = retryAfterSeconds * 1000 + 1000; // Add 1 second buffer
    const pauseDuration = duration;
    const queueName = queue.name;
    logger.info(
      { pauseDuration, queueName },
      "Pausing queue due to rate limit"
    );

    await queue.pause();
    await setTimeout(duration);
    await queue.resume();
  },

  /**
   * Extract retry duration from rate limit error
   */
  getRateLimitDuration(error: GrammyError): number {
    return error.parameters?.retry_after || 30;
  },

  /**
   * Log unhandled Telegram error
   */
  logUnhandledTelegramError(
    chatId: number,
    errorCode: number,
    errorDescription: string
  ): void {
    const error = errorDescription;
    logger.error({ chatId, errorCode, error }, "Unhandled Telegram error");
  },

  /**
   * Log unhandled generic error
   */
  logUnhandledGenericError(
    jobId: string | number | undefined,
    error: Error
  ): void {
    logger.error({ jobId, error }, "Unhandled generic error in job processing");
  },
};
