import { BotContext } from "../../../types/bot.types.js";
import { Composer } from "grammy";

// Create a composer to handle messages that come from inline query results
export const inlineResultMessage = new Composer<BotContext>();

// Handle messages that look like inline query result content
inlineResultMessage.on("message:text", async (ctx, next) => {
  const messageText = ctx.message.text;

  // Check if this message looks like an announcement from inline query results
  const isAnnouncementFormat =
    messageText.startsWith("Subject:") &&
    messageText.includes("\n\nDate:") &&
    messageText.includes("\n\nMessage:");

  if (isAnnouncementFormat) {
    // This is an inline query result message, don't pass it to other handlers
    return;
  }

  // Not an inline result message, continue to other handlers
  await next();
});
