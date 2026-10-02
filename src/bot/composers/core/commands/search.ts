import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { fmt, code } from "@grammyjs/parse-mode";
import { INLINE_SEARCH_HELP_KEYBOARD } from "../../inline-query/keyboards.js";
import { BotConfig } from "../../../../configs/bot.js";
import {
  blocks,
  heading,
  ICON,
  lines,
} from "../../../../utils/message-style.js";
import { coreCommand } from "./registry.js";

const metadata = coreCommand("search");

export const searchCommand = new Command<BotContext>(
  metadata.name,
  metadata.description,
  async (ctx: BotContext) => {
    const botUsername = `@${BotConfig.BOT_USERNAME}`;

    const example = (icon: string, label: string, query: string) =>
      lines([heading(icon, label), fmt`${code}${botUsername} ${query}${code}`]);

    const message = blocks([
      heading(ICON.search, "Search KTU from any chat"),
      fmt`Type ${botUsername} in any chat, add a prefix and your keywords, then pick a result.`,
      example(ICON.announcements, "Announcements", "ann: btech exam"),
      example(ICON.calendars, "Academic calendars", "cal: semester"),
      example(ICON.timetables, "Exam timetables", "tt: btech s3"),
      fmt`${ICON.pointer} Or tap a button below to get started.`,
    ]);

    await ctx.reply(message.text, {
      entities: message.entities,
      reply_markup: INLINE_SEARCH_HELP_KEYBOARD,
      link_preview_options: { is_disabled: true },
    });
  }
);
