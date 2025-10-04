import { getRandomSticker } from "../../../constants/stickers.js";
import { BotContext } from "../../../types/bot.types.js";
import { deleteMessageSafely } from "../../../utils/safeDelete.js";
import { Composer } from "grammy";
import { helpCommand } from "../core/composer.js";
import { formatCommand } from "../../../utils/getFormattedCommand.js";
import { emoji } from "@grammyjs/emoji";
import { BotConfig } from "../../../configs/bot.js";

// Create a composer for unhandled updates
export const composer = new Composer<BotContext>();

// Handle all unhandled messages
composer.on("message", async ctx => {
  // Only respond with this in private chats
  if (ctx.chat.type != "private") return;

  // Skip inline query messages from the bot itself
  const botInfo = await ctx.api.getMe();
  if (ctx.message.via_bot && ctx.message.via_bot.username === botInfo.username)
    return;

  const randomSticker = getRandomSticker();
  const stickerMsg = await ctx.replyWithSticker(randomSticker);

  await ctx.reply(
    `That doesn't seem like something I can do. Please use ${formatCommand(helpCommand)} to see what I can do.`
  );

  // Delete the sticker safely after 5 seconds
  setTimeout(() => {
    deleteMessageSafely(ctx, stickerMsg.message_id);
  }, BotConfig.UNKNOWN_COMMAND_STICKER_DELETION_TIMEOUT);
});

// Handle all unhandled callback queries
composer.on("callback_query", async ctx => {
  await ctx.answerCallbackQuery();
  await deleteMessageSafely(ctx, ctx.callbackQuery.message!.message_id);
  return await ctx.reply(
    `${emoji("warning")} Session expired. Please try the corresponding action again.`
  );
});

export const unhandled = composer;
