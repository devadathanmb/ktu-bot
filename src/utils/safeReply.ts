import { Context } from "grammy";

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
    // Silently ignore reply failures - same pattern as safeDelete
    return undefined;
  }
};
