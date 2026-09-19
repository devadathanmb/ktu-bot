import { GrammyError } from "grammy";
import { Queue } from "bullmq";
import { AnnouncementSubscriptionRepository } from "../../../db/repositories/announcement-subscription-repository.js";
import { ChatRepository } from "../../../db/repositories/chat-repository.js";
import { withTransaction } from "../../../db/transactions.js";
import { setTimeout } from "node:timers/promises";
import logger from "../../../utils/logger.js";

export async function handleWorkerGrammyError(
  chatId: number,
  error: GrammyError,
  queue: Queue
): Promise<void> {
  const { error_code: errorCode, description } = error;

  if (
    errorCode === 403 ||
    (errorCode === 400 && description.includes("USER_IS_BLOCKED"))
  ) {
    logger.warn(
      { chatId, err: error },
      "User blocked the bot, updating status"
    );
    await withTransaction(async tx => {
      const subscriptionRepo = new AnnouncementSubscriptionRepository(tx);
      const chatRepo = new ChatRepository(tx);
      await subscriptionRepo.delete(chatId);
      await chatRepo.createIfNotExists(chatId);
      await chatRepo.markKicked(chatId);
    });
    return;
  }

  if (
    (errorCode === 403 && description.includes("deactivated")) ||
    (errorCode === 400 && description.includes("USER_DEACTIVATED"))
  ) {
    logger.warn(
      { chatId, err: error },
      "User deactivated their account, removing chat"
    );
    await withTransaction(async tx => {
      await new ChatRepository(tx).delete(chatId);
    });
    return;
  }

  if (errorCode === 429) {
    const pauseDuration = (error.parameters?.retry_after || 30) * 1000 + 1000;
    logger.info(
      { chatId, pauseDuration, queueName: queue.name },
      "Pausing queue due to rate limit"
    );
    await queue.pause();
    await setTimeout(pauseDuration);
    await queue.resume();
  }

  // A rate-limited delivery must retry as well as pausing future jobs.
  // Other unrecovered failures are logged once at the worker boundary.
  throw error;
}
