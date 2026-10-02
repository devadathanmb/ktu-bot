import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { fmt, b, type FormattedString } from "@grammyjs/parse-mode";
import {
  formatCommand,
  joinWithNewlines,
} from "../../../../utils/formatting.js";
import { lookupCommandInfos } from "../../lookups/command-info.js";
import { announcementSubscriptionCommandInfos } from "../../announcement-subscriptions/command-info.js";
import { emoji } from "@grammyjs/emoji";
import { BotConfig } from "../../../../configs/bot.js";
import { coreCommand, coreCommands, type CoreCommandInfo } from "./registry.js";

const metadata = coreCommand("help");

function formatCommandSection(
  title: FormattedString,
  commands: readonly CoreCommandInfo[],
  layout: "compact" | "stacked" = "compact"
): FormattedString {
  const entries = commands.map(cmd =>
    layout === "stacked"
      ? joinWithNewlines([fmt`${formatCommand(cmd)}`, fmt`${cmd.description}`])
      : fmt`${formatCommand(cmd)}: ${cmd.description}`
  );
  return joinWithNewlines(
    [title, joinWithNewlines(entries, layout === "stacked" ? 2 : 1)],
    2
  );
}

export const helpCommand = new Command<BotContext>(
  metadata.name,
  metadata.description,
  async ctx => {
    const helpTitle = fmt`${b}Available Commands${b}`;
    const coreCommandsMessage = formatCommandSection(
      fmt`${emoji("gear")} ${b}Other commands${b}`,
      coreCommands
    );
    const lookupCommands = formatCommandSection(
      fmt`${emoji("magnifying_glass_tilted_left")} ${b}Find documents${b}`,
      lookupCommandInfos
    );
    const subscriptionCommands = formatCommandSection(
      fmt`${emoji("bell")} ${b}Announcement alerts${b}`,
      announcementSubscriptionCommandInfos,
      "stacked"
    );
    const inlineInfo = joinWithNewlines([
      fmt`${emoji("light_bulb")} ${b}Search in any chat${b}`,
      fmt`Type ${b}@${BotConfig.BOT_USERNAME}${b} followed by keywords to search announcements, timetables, and calendars. Use /search for examples.`,
    ]);

    const fullHelpMessage = joinWithNewlines(
      [
        helpTitle,
        lookupCommands,
        subscriptionCommands,
        coreCommandsMessage,
        inlineInfo,
      ],
      2
    );

    await ctx.reply(fullHelpMessage.text, {
      entities: fullHelpMessage.entities,
      link_preview_options: { is_disabled: true },
    });
  }
);
