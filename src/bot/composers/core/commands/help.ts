import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { emoji } from "@grammyjs/emoji";
import { fmt, type FormattedString } from "@grammyjs/parse-mode";
import { formatCommand } from "../../../../utils/formatting.js";
import {
  blocks,
  heading,
  ICON,
  lines,
  tip,
} from "../../../../utils/message-style.js";
import { lookupCommandInfos } from "../../lookups/command-info.js";
import { announcementSubscriptionCommandInfos } from "../../announcement-subscriptions/command-info.js";
import { BotConfig } from "../../../../configs/bot.js";
import { coreCommand, coreCommands } from "./registry.js";

const metadata = coreCommand("help");

interface HelpEntry {
  readonly name: string;
  readonly description: string;
}

// Command on its own line, description under it, so long command names never
// wrap awkwardly next to their description.
function commandSection(
  title: FormattedString,
  commands: readonly HelpEntry[]
): FormattedString {
  const entries = commands.map(cmd =>
    lines([fmt`${formatCommand(cmd)}`, fmt`${cmd.description}`])
  );
  return blocks([title, ...entries]);
}

export const helpCommand = new Command<BotContext>(
  metadata.name,
  metadata.description,
  async ctx => {
    const message = blocks([
      commandSection(
        heading(ICON.search, "Find documents"),
        lookupCommandInfos
      ),
      commandSection(
        heading(ICON.alertsOn, "Announcement alerts"),
        announcementSubscriptionCommandInfos
      ),
      commandSection(heading(emoji("gear"), "More"), coreCommands),
      tip(
        `Search from any chat: type @${BotConfig.BOT_USERNAME} and your keywords. Send /search for examples.`
      ),
    ]);

    await ctx.reply(message.text, {
      entities: message.entities,
      link_preview_options: { is_disabled: true },
    });
  }
);
