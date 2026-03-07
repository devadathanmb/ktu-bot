import { BotError, NextFunction } from "grammy";
import { BotContext, SessionData } from "../../../types/bot.types.js";
import { deleteMessageSafely } from "../../../utils/bot.js";
import { replyMessageSafely } from "../../../utils/bot.js";
import {
  KTUAPIError,
  SessionNotFoundError,
} from "../../../errors/BotErrors.js";
import { HandledBotError } from "../../../errors/HandledBotError.js";
import { emoji } from "@grammyjs/emoji";
import logger from "../../../utils/logger.js";

/**
 * Session keys that contain message IDs for loading/status messages
 * Use keyof SessionData so LSP can provide autocomplete and type checking
 */
type LoadingMessageKey = keyof SessionData;

/**
 * Creates an error boundary for composers that handles cleanup of loading messages
 * stored in session when errors occur, and uses the actual error message from API errors
 *
 * @param loadingMessageKeys - Array of session keys that contain message IDs to clean up
 * @param fallbackErrorMessage - Optional fallback message if no specific error message is available
 * @returns Error boundary handler function
 *
 * @example
 * ```typescript
 * const timetableComposer = new Composer<BotContext>();
 *
 * // Add error boundary that cleans up timetable loading messages
 * const protectedComposer = timetableComposer.errorBoundary(
 *   createComposerErrorBoundary(["timetableMessageId"])
 * );
 *
 * protectedComposer.on("callback_query", async (ctx) => {
 *   // Store loading message ID in session
 *   const loadingMsg = await ctx.reply("⏳ Fetching timetables...");
 *   ctx.session.timetableMessageId = loadingMsg.message_id;
 *
 *   // This could throw a KTUAPIError with a specific user message
 *   const data = await fetchTimetables();
 *
 *   // Update the loading message with results
 *   await ctx.editMessageText("Results: " + data);
 * });
 * ```
 */
export function createComposerErrorBoundary(
  loadingMessageKeys: LoadingMessageKey[],
  fallbackErrorMessage?: string
) {
  return async (error: BotError<BotContext>, _next: NextFunction) => {
    const ctx = error.ctx;

    // Extract the actual error message from KTUAPIError or use fallback
    let userErrorMessage: string;

    if (
      error.error instanceof KTUAPIError ||
      error.error instanceof SessionNotFoundError
    ) {
      // Use the specific user message from the API error
      userErrorMessage = error.error.userMessage;
    } else {
      // Use fallback message for other errors
      userErrorMessage =
        fallbackErrorMessage ||
        `${emoji("slightly_frowning_face")} Sorry, something went wrong on my end. Please try again.`;

      // Log the general error
      const chatId = ctx.chat?.id;
      const userId = ctx.from?.id;
      const username = ctx.from?.username;
      const update = ctx.update;
      const session = ctx.session;
      logger.error(
        {
          error: error.error,
          chatId,
          userId,
          username,
          update,
          session,
        },
        `Composer error boundary triggered`
      );
    }

    // Track cleanup actions for metadata
    const cleanupActions: string[] = [];

    // Clean up any loading messages stored in session
    for (const key of loadingMessageKeys) {
      const messageId = ctx.session[key];
      if (typeof messageId === "number") {
        await deleteMessageSafely(ctx, messageId);
        // Clear the message ID from session since we deleted it
        delete ctx.session[key];
        cleanupActions.push(`deleted-loading-message-${String(key)}`);
      }
    }

    // Send the actual error message to the user
    await replyMessageSafely(ctx, userErrorMessage);
    await deleteMessageSafely(
      ctx,
      ctx.update?.callback_query?.message?.message_id
    );

    // Wrap the original error to indicate it was handled by this boundary
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

/**
 * Convenience function to create error boundary specifically for timetable composers
 */
export const createTimetableErrorBoundary = (fallbackErrorMessage?: string) =>
  createComposerErrorBoundary(["timetableMessageId"], fallbackErrorMessage);

/**
 * Convenience function to create error boundary specifically for announcements composers
 */
export const createAnnouncementsErrorBoundary = (
  fallbackErrorMessage?: string
) =>
  createComposerErrorBoundary(["announcementsMessageId"], fallbackErrorMessage);

/**
 * Convenience function to create error boundary specifically for calendar composers
 */
export const createCalendarErrorBoundary = (fallbackErrorMessage?: string) =>
  createComposerErrorBoundary(["calendarMessageId"], fallbackErrorMessage);

/**
 * Convenience function to create error boundary specifically for announcement subscription composers
 */
export const createAnnouncementSubscriptionErrorBoundary = (
  fallbackErrorMessage?: string
) =>
  createComposerErrorBoundary(
    ["announcementSubscriptionMessageId"],
    fallbackErrorMessage
  );
