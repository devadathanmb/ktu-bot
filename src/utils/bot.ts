import { Context } from "grammy";
import logger from "./logger.js";

/**
 * Bot API utilities for safe message operations.
 *
 * These functions wrap Grammy's bot API methods with error handling to prevent
 * uncaught exceptions from common scenarios like deleted messages, blocked bots,
 * or permission issues.
 */

/**
 * Safely delete a message from a chat without throwing errors
 *
 * This function attempts to delete a message but silently handles any errors that occur,
 * such as when the message was already deleted or cannot be deleted due to permissions.
 * If messageId is undefined or falsy, the function will do nothing.
 *
 * @param ctx - Bot context containing chat information and API access
 * @param messageId - ID of the message to delete (optional)
 *
 * @example
 * ```typescript
 * await deleteMessageSafely(ctx, 12345);
 * // Message will be deleted if possible, no error thrown if it fails
 *
 * await deleteMessageSafely(ctx, ctx.message?.message_id);
 * // Safe to pass potentially undefined message_id
 * ```
 */
export const deleteMessageSafely = async (ctx: Context, messageId?: number) => {
  try {
    if (messageId) {
      logger.debug(`Deleting message ${messageId} in chat ${ctx.chat?.id}`);
      await ctx.api.deleteMessage(ctx.chat!.id, messageId);
    }
  } catch {
    // Silently ignore deletion failures
  }
};

/**
 * Safely edit a message without throwing errors
 *
 * This function attempts to edit a message but silently handles any errors that occur,
 * such as when the message was already deleted, cannot be edited due to permissions,
 * or the content hasn't changed.
 *
 * @param ctx - Bot context containing chat information and API access
 * @param messageId - ID of the message to edit
 * @param text - New text content for the message
 * @param other - Optional additional parameters for the edit (parse_mode, reply_markup, etc.)
 * @returns true if edit succeeded, false otherwise
 *
 * @example
 * ```typescript
 * await editMessageSafely(ctx, messageId, "Updated message text");
 * // Message will be edited if possible, no error thrown if it fails
 *
 * await editMessageSafely(ctx, messageId, "Updated text", { parse_mode: "HTML" });
 * // With additional options
 * ```
 */
export const editMessageSafely = async (
  ctx: Context,
  messageId: number,
  text: string,
  other?: Parameters<Context["api"]["editMessageText"]>[3]
): Promise<boolean> => {
  try {
    await ctx.api.editMessageText(ctx.chat!.id, messageId, text, other);
    return true;
  } catch (error) {
    logger.debug(error, "Failed to edit message");
    return false;
  }
};

/**
 * Safely edit message reply markup without throwing errors
 *
 * This function attempts to edit only the reply markup of a message but silently
 * handles any errors that occur, such as when the message was already deleted
 * or cannot be edited due to permissions.
 *
 * @param ctx - Bot context containing chat information and API access
 * @param replyMarkup - New reply markup for the message
 *
 * @example
 * ```typescript
 * await editMessageReplyMarkupSafely(ctx, newKeyboard);
 * // Reply markup will be edited if possible, no error thrown if it fails
 * ```
 */
export const editMessageReplyMarkupSafely = async (
  ctx: Context,
  replyMarkup?: Parameters<Context["editMessageReplyMarkup"]>[0]
) => {
  try {
    await ctx.editMessageReplyMarkup(replyMarkup);
  } catch {
    // Silently ignore edit failures - same pattern as deleteMessageSafely and replyMessageSafely
  }
};

/**
 * Safely send a reply message without throwing errors
 *
 * This function attempts to send a reply message but silently handles any errors that occur,
 * such as when the chat is no longer accessible, the bot is blocked, or other API restrictions.
 *
 * @param ctx - Bot context containing chat information and API access
 * @param text - The message text to send as a reply
 * @param other - Optional additional parameters for the reply (parse_mode, reply_markup, etc.)
 * @returns The sent Message object if successful, undefined if failed
 *
 * @example
 * ```typescript
 * const sentMessage = await replyMessageSafely(ctx, "Hello world!");
 * if (sentMessage) {
 *   console.log(`Message sent with ID: ${sentMessage.message_id}`);
 * }
 *
 * const sentMessage = await replyMessageSafely(ctx, "Error occurred", { parse_mode: "HTML" });
 * // With additional options
 * ```
 */
export const replyMessageSafely = async (
  ctx: Context,
  text: string,
  other?: Parameters<Context["reply"]>[1]
) => {
  try {
    return await ctx.reply(text, other);
  } catch {
    // Silently ignore reply failures - same pattern as deleteMessageSafely
    return undefined;
  }
};

/**
 * Telegram Media Types
 *
 * Set containing all media types supported by Telegram messages.
 * Used for efficient O(1) lookup when determining message media type.
 */
export const TELEGRAM_MEDIA_TYPES = new Set<string>([
  "photo",
  "video",
  "document",
  "audio",
  "voice",
  "sticker",
  "animation",
  "location",
  "contact",
]);

/**
 * Extract media type from a Telegram message
 *
 * Checks if a message contains any media type (photo, video, document, etc.)
 * and returns the media type if found. This is useful for logging, metrics,
 * and conditional handling based on message content type.
 *
 * @param message - Telegram message object (can be undefined)
 * @returns The media type string if media is present, undefined otherwise
 *
 * @example
 * ```typescript
 * const mediaType = getMediaType(ctx.message);
 * if (mediaType === "photo") {
 *   console.log("User sent a photo");
 * }
 * ```
 */
export function getMediaType(message: object | undefined): string | undefined {
  if (!message) return undefined;

  for (const key in message) {
    if (TELEGRAM_MEDIA_TYPES.has(key)) {
      return key;
    }
  }

  return undefined;
}

/**
 * Determine the complete message type including text and commands
 *
 * Provides a comprehensive classification of message types by first checking
 * for media (photo, video, etc.), then checking if it's a command, and finally
 * falling back to "text" for plain text messages.
 *
 * @param message - Telegram message object
 * @returns Message type: media type (photo, video, etc.), "command", or "text"
 *
 * @example
 * ```typescript
 * const messageType = getMessageType(ctx.message);
 * // Returns: "photo" | "video" | "document" | "command" | "text" | etc.
 *
 * if (messageType === "command") {
 *   // Handle bot command
 * }
 * ```
 */
export function getMessageType(message: object): string {
  // Check for media first
  const mediaType = getMediaType(message);
  if (mediaType) return mediaType;

  // Check if it's a command
  const msg = message as { text?: string };
  if (msg.text?.startsWith("/")) {
    return "command";
  }

  return "text";
}

/**
 * Extract the update type from a Telegram update
 *
 * Telegram updates can be of various types (message, callback_query, inline_query, etc.).
 * This function identifies the type by examining the update object keys.
 *
 * @param update - Telegram update object
 * @returns The update type (message, callback_query, inline_query, etc.) or "unknown"
 *
 * @example
 * ```typescript
 * const updateType = getUpdateType(ctx.update);
 * // Returns: "message" | "callback_query" | "inline_query" | "edited_message" | etc.
 *
 * logger.info({ updateType }, "Processing update");
 * ```
 */
export function getUpdateType(update: object): string {
  for (const key in update) {
    if (key !== "update_id") {
      return key;
    }
  }
  return "unknown";
}

/**
 * Classify inline query type based on content
 *
 * Categorizes inline queries as either "empty" (no query text) or "search" (has query text).
 * Can be extended in the future with more sophisticated query classification logic.
 *
 * @param query - Inline query string (optional)
 * @returns Query classification: "empty" if query is empty/undefined, "search" otherwise
 *
 * @example
 * ```typescript
 * const queryType = getInlineQueryType(ctx.inlineQuery?.query);
 * if (queryType === "empty") {
 *   // Show default results
 * } else {
 *   // Show search results
 * }
 * ```
 */
export function getInlineQueryType(query?: string): string {
  if (!query || query.trim() === "") {
    return "empty";
  }

  // Can be extended with more sophisticated query classification
  return "search";
}
