import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { fmt, b } from "@grammyjs/parse-mode";
import { combineFormattedDouble } from "../../../../utils/combineFormatted.js";
import { announcementsCommands } from "../../lookups/announcements/composer.js";
import { calendarCommands } from "../../lookups/calendar/composer.js";
import { timetableCommands } from "../../lookups/timetable/composer.js";
import { announcementSubscriptionsCommands } from "../../announcementSubscriptions/composer.js";
import { coreCommandsGroup } from "../composer.js";
import { emoji } from "@grammyjs/emoji";

export const helpCommand = new Command<BotContext>(
  "help",
  `${emoji("red_question_mark")} Show comprehensive help with all available commands`,
  async ctx => {
    const helpTitle = fmt`${b}Available Commands${b}`;
    const commands = coreCommandsGroup.commands;
    const coreCommands = fmt`${emoji("gear")} ${b}Core Commands${b}
${commands.map(cmd => `• /${cmd.name} - ${cmd.description}`).join("\n")}`;
    const allLookupCommands = [
      ...announcementsCommands.commands,
      ...calendarCommands.commands,
      ...timetableCommands.commands,
    ];
    const lookupCommands = fmt`${emoji("magnifying_glass_tilted_left")} ${b}Lookup Commands${b}
${allLookupCommands.map(cmd => `• /${cmd.name} - ${cmd.description}`).join("\n")}`;
    const allNotificationCommands = announcementSubscriptionsCommands.commands;
    const subscriptionCommands = fmt`${emoji("bell")} ${b}Notification Commands${b}
${allNotificationCommands.map(cmd => `• /${cmd.name} - ${cmd.description}`).join("\n")}`;
    const inlineInfo = fmt`${emoji("light_bulb")} ${b}Pro Tip${b}
Type ${b}@ktu_results_bot${b} followed by keywords in any chat to search any announcements, exam timetables or academic calendars instantly without opening the bot!`;

    const fullHelpMessage = combineFormattedDouble([
      helpTitle,
      coreCommands,
      lookupCommands,
      subscriptionCommands,
      inlineInfo,
    ]);

    await ctx.reply(fullHelpMessage.text, {
      entities: fullHelpMessage.entities,
      link_preview_options: { is_disabled: true },
    });
  }
);
