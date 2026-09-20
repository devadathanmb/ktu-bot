import { Context, GrammyError } from "grammy";
import logger from "./logger.js";

/** Deletes a message, silently ignoring failures and missing ids. */
export const deleteMessageSafely = async (ctx: Context, messageId?: number) => {
  try {
    if (messageId) {
      logger.debug({ messageId, chatId: ctx.chat?.id }, "Deleting message");
      await ctx.api.deleteMessage(ctx.chat!.id, messageId);
    }
  } catch {
    // Silently ignore deletion failures
  }
};

/** Returns false and logs when the edit fails. */
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
    const chatId = ctx.chat?.id;
    logger.error({ err: error, chatId, messageId }, "Failed to edit message");
    return false;
  }
};

/** Returns undefined when the reply fails. */
export const replyMessageSafely = async (
  ctx: Context,
  text: string,
  other?: Parameters<Context["reply"]>[1]
) => {
  try {
    return await ctx.reply(text, other);
  } catch {
    return undefined;
  }
};

/** Duplicate taps send the same callback twice; the second edit is a no-op. */
export function isMessageNotModifiedError(error: unknown): boolean {
  return (
    error instanceof GrammyError &&
    error.error_code === 400 &&
    error.description.includes("message is not modified")
  );
}

/**
 * Runs a message edit, treating Telegram's no-op response as success.
 * Returns whether the message changed; callers must skip follow-up
 * sends when it returns false to stay idempotent on duplicate taps.
 */
export async function editMessageIgnoringNotModified(
  edit: () => Promise<unknown>
): Promise<boolean> {
  try {
    await edit();
    return true;
  } catch (error) {
    if (!isMessageNotModifiedError(error)) throw error;
    return false;
  }
}

const TELEGRAM_MEDIA_TYPES = new Set<string>([
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

export function getMediaType(message: object | undefined): string | undefined {
  if (!message) return undefined;

  for (const key in message) {
    if (TELEGRAM_MEDIA_TYPES.has(key)) {
      return key;
    }
  }

  return undefined;
}

export function getMessageType(message: object): string {
  const mediaType = getMediaType(message);
  if (mediaType) return mediaType;

  const msg = message as { text?: string };
  if (msg.text?.startsWith("/")) {
    return "command";
  }

  return "text";
}

export function getUpdateType(update: object): string {
  for (const key in update) {
    if (key !== "update_id") {
      return key;
    }
  }
  return "unknown";
}

export function getInlineQueryType(query?: string): string {
  if (!query || query.trim() === "") {
    return "empty";
  }

  return "search";
}
