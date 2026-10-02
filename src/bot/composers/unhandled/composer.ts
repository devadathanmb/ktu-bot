import { getRandomSticker } from "../../../constants/stickers.js";
import { BotContext } from "../../../types/bot.types.js";
import { deleteMessageSafely } from "../../../utils/bot.js";
import { Composer } from "grammy";
import { coreCommand } from "../core/commands/registry.js";
import { formatCommand } from "../../../utils/formatting.js";
import { blocks, ICON, problem } from "../../../utils/message-style.js";
import { fmt } from "@grammyjs/parse-mode";
import { BotConfig } from "../../../configs/bot.js";

export const composer = new Composer<BotContext>();

composer.on("message", async ctx => {
  if (ctx.chat.type != "private") return;

  const botInfo = await ctx.api.getMe();
  if (ctx.message.via_bot && ctx.message.via_bot.username === botInfo.username)
    return;

  const randomSticker = getRandomSticker();
  const stickerMsg = await ctx.replyWithSticker(randomSticker);

  await ctx.reply(
    blocks([
      fmt`${ICON.tip} I only understand commands.`,
      fmt`Send ${formatCommand(coreCommand("help"))} to see them, or ${formatCommand(coreCommand("search"))} to find KTU documents.`,
    ]).text
  );

  setTimeout(() => {
    void deleteMessageSafely(ctx, stickerMsg.message_id);
  }, BotConfig.UNKNOWN_COMMAND_STICKER_DELETION_TIMEOUT);
});

composer.on("callback_query", async ctx => {
  await ctx.answerCallbackQuery();
  await deleteMessageSafely(ctx, ctx.callbackQuery.message!.message_id);
  return await ctx.reply(
    problem(
      "These buttons have expired.",
      `Run the command again to continue, or use ${formatCommand(coreCommand("help"))} to see all commands.`
    ).text
  );
});

export const unhandled = composer;
