import { Context } from "grammy";
import { CommandsFlavor } from "@grammyjs/commands";
import { EmojiFlavor } from "@grammyjs/emoji";
import { coreCommand } from "../composers/core/commands/registry.js";
import { formatCommand, joinWithNewlines } from "../../utils/formatting.js";
import { fmt } from "@grammyjs/parse-mode";
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
      fmt`${emoji("thinking_face")} Did you mean ${ctx.commandSuggestion}?`.text
    );
  } else {
    await ctx.reply(
      joinWithNewlines(
        [
          fmt`${emoji("red_question_mark")} I don’t recognise that command.`,
          fmt`Use ${formatCommand(coreCommand("help"))} to see the available commands.`,
        ],
        2
      ).text
    );
  }
};
