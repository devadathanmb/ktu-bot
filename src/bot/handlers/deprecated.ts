import { CommandContext } from "grammy";
import { BotContext } from "../../types/bot.types.js";
import { DEPRECATED_COMMAND_TO_REASON_MAP } from "../../constants/bot.js";
import { formatCommand, joinWithNewlines } from "../../utils/formatting.js";
import { fmt } from "@grammyjs/parse-mode";
import { helpCommand } from "../composers/core/composer.js";

export const deprecatedCommandHandler = async (
  ctx: CommandContext<BotContext>
) => {
  const command = ctx.message!.text.split(" ")[0]!.slice(1);

  const deprecationMsg = DEPRECATED_COMMAND_TO_REASON_MAP[command] || [
    fmt`Sorry, this feature has been deprecated.`,
    fmt`Please refer to ${formatCommand(helpCommand)} for available commands.`,
  ];

  const formattedReply = joinWithNewlines(deprecationMsg, 2);
  return await ctx.reply(formattedReply.text, {
    entities: formattedReply.entities,
    link_preview_options: { is_disabled: true },
  });
};
