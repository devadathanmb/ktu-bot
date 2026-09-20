import { Context } from "grammy";
import { CommandsFlavor } from "@grammyjs/commands";
import { EmojiFlavor } from "@grammyjs/emoji";
import { coreCommand } from "../composers/core/commands/registry.js";
import { formatCommand } from "../../utils/formatting.js";
import { deleteMessageSafely } from "../../utils/bot.js";
import { getRandomSticker } from "../../constants/stickers.js";
import { emoji } from "@grammyjs/emoji";
import { BotConfig } from "../../configs/bot.js";

type UnknownCommandContext = Context &
  CommandsFlavor &
  EmojiFlavor & {
    commandSuggestion: string | null;
  };
export const unknownCommandHandler = async (ctx: UnknownCommandContext) => {
  const randomSticker = getRandomSticker();
  const stickerMsg = await ctx.replyWithSticker(randomSticker);

  setTimeout(() => {
    void deleteMessageSafely(ctx, stickerMsg.message_id);
  }, BotConfig.UNKNOWN_COMMAND_STICKER_DELETION_TIMEOUT);

  if (ctx.commandSuggestion) {
    await ctx.reply(
      `${emoji("thinking_face")} Hmm... I don't know that command. Did you mean ${ctx.commandSuggestion}?`
    );
  } else {
    await ctx.reply(
      `${emoji("crying_face")} Oops... I don't know that command. Use ${formatCommand(coreCommand("help"))}`
    );
  }
};
