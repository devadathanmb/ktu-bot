import { Context } from "grammy";

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
