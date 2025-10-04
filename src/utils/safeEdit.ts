import { Context } from "grammy";
import logger from "./logger.js";

/**
 * Safely edit a message without throwing errors
 *
 * This function attempts to edit a message but silently handles any errors that occur,
 * such as when the message was already deleted, cannot be edited due to permissions,
 * or the content hasn't changed.
 *
 * @param ctx - Bot context containing chat information and API access
 * @param text - New text content for the message
 * @param other - Optional additional parameters for the edit (parse_mode, reply_markup, etc.)
 *
 * @example
 * ```typescript
 * await editMessageSafely(ctx, "Updated message text");
 * // Message will be edited if possible, no error thrown if it fails
 *
 * await editMessageSafely(ctx, "Updated text", { parse_mode: "HTML" });
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
    // Silently ignore edit failures - same pattern as safeDelete and safeReply
  }
};
