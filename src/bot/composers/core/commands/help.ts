import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { fmt, b } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../../utils/formatting.js";
import { lookupCommandInfos } from "../../lookups/command-info.js";
import { announcementSubscriptionsCommands } from "../../announcement-subscriptions/composer.js";
import { emoji } from "@grammyjs/emoji";
import { BotConfig } from "../../../../configs/bot.js";
import { coreCommand, coreCommands } from "./registry.js";

const metadata = coreCommand("help");

export const helpCommand = new Command<BotContext>(
  metadata.name,
  metadata.description,
  async ctx => {
    const helpTitle = fmt`${b}Available Commands${b}`;
    const commands = coreCommands;
    const coreCommandsMessage = fmt`${emoji("gear")} ${b}Core Commands${b}
${commands.map(cmd => `• /${cmd.name} - ${cmd.description}`).join("\n")}`;
    const allLookupCommands = lookupCommandInfos;
    const lookupCommands = fmt`${emoji("magnifying_glass_tilted_left")} ${b}Lookup Commands${b}
${allLookupCommands.map(cmd => `• /${cmd.name} - ${cmd.description}`).join("\n")}`;
    const allNotificationCommands = announcementSubscriptionsCommands.commands;
    const subscriptionCommands = fmt`${emoji("bell")} ${b}Notification Commands${b}
${allNotificationCommands.map(cmd => `• /${cmd.name} - ${cmd.description}`).join("\n")}`;
    const inlineInfo = fmt`${emoji("light_bulb")} ${b}Pro Tip${b}
Type ${b}@${BotConfig.BOT_USERNAME}${b} followed by keywords in any chat to search any announcements, exam timetables or academic calendars instantly without opening the bot!`;

    const fullHelpMessage = joinWithNewlines(
      [
        helpTitle,
        coreCommandsMessage,
        lookupCommands,
        subscriptionCommands,
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
