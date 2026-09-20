import { GrammyError } from "grammy";
import { Queue } from "bullmq";
import { AnnouncementSubscriptionRepository } from "../../../db/repositories/announcement-subscription-repository.js";
import { ChatRepository } from "../../../db/repositories/chat-repository.js";
import { withTransaction } from "../../../db/transactions.js";
import { setTimeout } from "node:timers/promises";
import logger from "../../../utils/logger.js";

export type WorkerGrammyErrorKind =
  | "user_deactivated"
  | "user_blocked"
  | "rate_limited"
  | "unhandled";

export function classifyWorkerGrammyError(
  error: GrammyError
): WorkerGrammyErrorKind {
  const { error_code: errorCode, description } = error;

  // Deactivated accounts also return 403, so this must be checked before the
  // broader blocked-user condition below.
  if (
    (errorCode === 403 && description.includes("deactivated")) ||
    (errorCode === 400 && description.includes("USER_DEACTIVATED"))
  ) {
    return "user_deactivated";
  }

  if (
    errorCode === 403 ||
    (errorCode === 400 && description.includes("USER_IS_BLOCKED"))
  ) {
    return "user_blocked";
  }

  if (errorCode === 429) {
    return "rate_limited";
  }

  return "unhandled";
}

export async function handleWorkerGrammyError(
  chatId: number,
  error: GrammyError,
  queue: Queue
): Promise<void> {
  const kind = classifyWorkerGrammyError(error);

  if (kind === "user_deactivated") {
    logger.warn(
      { chatId, err: error },
      "User deactivated their account, removing chat"
    );
    await withTransaction(async tx => {
      await new ChatRepository(tx).delete(chatId);
    });
    return;
  }

  if (kind === "user_blocked") {
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

  if (kind === "rate_limited") {
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
