import { CommandContext } from "grammy";
import { BotContext } from "../../types/bot.types.js";
import { DEPRECATED_COMMAND_TO_DESC_MAP } from "../../constants/bot.js";
import { combineFormattedDouble } from "../../utils/combineFormatted.js";
import { fmt } from "@grammyjs/parse-mode";
import { formatCommand } from "../../utils/getFormattedCommand.js";
import { helpCommand } from "../composers/core/composer.js";

export const deprecatedCommandHandler = async (
  ctx: CommandContext<BotContext>
) => {
  // Get the command
  const command = ctx.message!.text!.split(" ")[0]!.slice(1)!;

  // Find the prepared response
  const deprecationMsg = DEPRECATED_COMMAND_TO_DESC_MAP[command] || [
    fmt`Sorry, this feature has been deprecated.`,
    fmt`Please refer to ${formatCommand(helpCommand)} for available commands.`,
  ];

  // Format and send the message
  const formattedReply = combineFormattedDouble(deprecationMsg);
  return await ctx.reply(formattedReply.text, {
    entities: formattedReply.entities,
    link_preview_options: { is_disabled: true },
  });
};
