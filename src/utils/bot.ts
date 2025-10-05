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
