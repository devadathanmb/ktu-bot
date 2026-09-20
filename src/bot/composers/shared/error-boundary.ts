import { BotError, NextFunction } from "grammy";
import { BotContext, SessionData } from "../../../types/bot.types.js";
import { deleteMessageSafely } from "../../../utils/bot.js";
import { replyMessageSafely } from "../../../utils/bot.js";
import {
  KTUAPIError,
  SessionNotFoundError,
} from "../../../errors/bot-errors.js";
import { HandledBotError } from "../../../errors/handled-bot-error.js";
import { emoji } from "@grammyjs/emoji";
import logger from "../../../utils/logger.js";

type LoadingMessageKey = {
  [K in keyof SessionData]: SessionData[K] extends number | null ? K : never;
}[keyof SessionData];

export function createComposerErrorBoundary(
  loadingMessageKeys: LoadingMessageKey[],
  fallbackErrorMessage?: string
) {
  return async (error: BotError<BotContext>, _next: NextFunction) => {
    const ctx = error.ctx;

    let userErrorMessage: string;

    if (
      error.error instanceof KTUAPIError ||
      error.error instanceof SessionNotFoundError
    ) {
      userErrorMessage = error.error.userMessage;
    } else {
      userErrorMessage =
        fallbackErrorMessage ||
        `${emoji("slightly_frowning_face")} Sorry, something went wrong on my end. Please try again.`;

      const chatId = ctx.chat?.id;
      const userId = ctx.from?.id;
      const username = ctx.from?.username;
      logger.error(
        {
          err: error.error,
          chatId,
          userId,
          username,
        },
        "Composer error boundary triggered"
      );
    }

    const cleanupActions: string[] = [];

    for (const key of loadingMessageKeys) {
      const messageId = ctx.session[key];
      if (typeof messageId === "number") {
        await deleteMessageSafely(ctx, messageId);
        // Keep the runtime session shape aligned with SessionData.
        ctx.session[key] = null;
        cleanupActions.push(`deleted-loading-message-${String(key)}`);
      }
    }

    await replyMessageSafely(ctx, userErrorMessage);
    await deleteMessageSafely(
      ctx,
      ctx.update?.callback_query?.message?.message_id
    );

    const originalError =
      error.error instanceof Error
        ? error.error
        : new Error(String(error.error));

    const handledError = new HandledBotError(
      originalError,
      "composer-error-boundary",
      true, // user was notified
      cleanupActions
    );

    // Re-throw wrapped error so global handler can track metrics centrally
    throw handledError;
  };
}

export const createTimetableErrorBoundary = (fallbackErrorMessage?: string) =>
  createComposerErrorBoundary(["timetableMessageId"], fallbackErrorMessage);

export const createAnnouncementsErrorBoundary = (
  fallbackErrorMessage?: string
) =>
  createComposerErrorBoundary(["announcementsMessageId"], fallbackErrorMessage);

export const createCalendarErrorBoundary = (fallbackErrorMessage?: string) =>
  createComposerErrorBoundary(["calendarMessageId"], fallbackErrorMessage);

export const createAnnouncementSubscriptionErrorBoundary = (
  fallbackErrorMessage?: string
) =>
  createComposerErrorBoundary(
    ["announcementSubscriptionMessageId"],
    fallbackErrorMessage
  );

export const createSyllabusErrorBoundary = (fallbackErrorMessage?: string) =>
  createComposerErrorBoundary(["syllabusMessageId"], fallbackErrorMessage);
