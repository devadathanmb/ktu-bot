import { GrammyError } from "grammy";
import { Queue } from "bullmq";
import { AnnouncementSubscriptionRepository } from "../../../db/repositories/announcement-subscription-repository.js";
import { ChatRepository } from "../../../db/repositories/chat-repository.js";
import { withTransaction } from "../../../db/transactions.js";
import { setTimeout } from "node:timers/promises";
import logger from "../../../utils/logger.js";

export class TelegramErrorUtils {
  static isUserBlockedError(errorCode: number, description: string): boolean {
    return (
      errorCode === 403 ||
      (errorCode === 400 && description.includes("USER_IS_BLOCKED"))
    );
  }

  static isUserDeactivatedError(
    errorCode: number,
    description: string
  ): boolean {
    return (
      (errorCode === 403 && description.includes("deactivated")) ||
      (errorCode === 400 && description.includes("USER_DEACTIVATED"))
    );
  }

  static isRateLimitError(errorCode: number): boolean {
    return errorCode === 429;
  }

  static async handleBlockedUser(chatId: number): Promise<void> {
    await withTransaction(async tx => {
      const subscriptionRepo = new AnnouncementSubscriptionRepository(tx);
      const chatRepo = new ChatRepository(tx);

      await subscriptionRepo.delete(chatId);
      await chatRepo.createIfNotExists(chatId);
      await chatRepo.markKicked(chatId);
    });
  }

  static async handleDeactivatedUser(chatId: number): Promise<void> {
    await withTransaction(async tx => {
      const chatRepo = new ChatRepository(tx);
      await chatRepo.delete(chatId);
    });
  }

  static async handleRateLimitWithQueuePause(
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
  }

  static getRateLimitDuration(error: GrammyError): number {
    return error.parameters?.retry_after || 30;
  }

  static logUnhandledTelegramError(
    chatId: number,
    errorCode: number,
    errorDescription: string
  ): void {
    logger.error(
      { chatId, errorCode, errorDescription },
      "Unhandled Telegram error"
    );
  }

  static logUnhandledGenericError(
    jobId: string | number | undefined,
    error: Error
  ): void {
    logger.error(
      { jobId, err: error },
      "Unhandled generic error in job processing"
    );
  }

  static async handleWorkerGrammyError(
    chatId: number,
    error: GrammyError,
    queue: Queue
  ): Promise<void> {
    const errorCode = error.error_code;
    const errorDescription = error.description;

    if (this.isUserBlockedError(errorCode, errorDescription)) {
      logger.warn(
        { chatId, errorCode, errorDescription },
        "User blocked the bot, updating status"
      );
      await this.handleBlockedUser(chatId);
    } else if (this.isUserDeactivatedError(errorCode, errorDescription)) {
      logger.warn(
        { chatId, errorCode, errorDescription },
        "User deactivated their account, removing chat"
      );
      await this.handleDeactivatedUser(chatId);
    } else if (this.isRateLimitError(errorCode)) {
      const retryAfter = this.getRateLimitDuration(error);
      await this.handleRateLimitWithQueuePause(queue, retryAfter);
      // Re-throw so BullMQ marks the job as failed and retries it later.
      // Without this, the job is silently completed and the message to
      // this chatId is dropped forever. The queue pause protects future
      // jobs from hitting the same rate limit; the retry ensures this
      // specific delivery is eventually completed.
      throw error;
    } else {
      this.logUnhandledTelegramError(chatId, errorCode, errorDescription);
      throw error;
    }
  }
}
