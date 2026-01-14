import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { fmt, b, code } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import { INLINE_SEARCH_HELP_KEYBOARD } from "../../inline-query/keyboards.js";

export const searchCommand = new Command<BotContext>(
  "search",
  `${emoji("magnifying_glass_tilted_left")} Search KTU resources using inline queries`,
  async (ctx: BotContext) => {
    const title = fmt`${emoji("magnifying_glass_tilted_left")} ${b}Search KTU Resources${b}`;
    const description = fmt`Use inline queries to search for KTU announcements, calendars, and timetables instantly! Just type ${code}@ktu_results_bot${code} followed by your search terms in any chat.`;

    const searchTypes = joinWithNewlines([
      fmt`${emoji("books")} ${b}Search Types${b}`,
      joinWithNewlines(
        [
          fmt`${emoji("loudspeaker")} ${code}ann:${code} — Search ${b}announcements${b} (e.g., ${code}ann: btech exam${code})`,
          fmt`${emoji("calendar")} ${code}cal:${code} — Search ${b}academic calendars${b} (e.g., ${code}cal: semester${code})`,
          fmt`${emoji("clipboard")} ${code}tt:${code} — Search ${b}exam timetables${b} (e.g., ${code}tt: btech s3${code})`,
        ],
        2
      ),
    ]);

    const howToUse = joinWithNewlines([
      fmt`${emoji("light_bulb")} ${b}How to Use${b}`,
      fmt`Type ${code}@ktu_results_bot prefix: query${code} in any chat, or use the buttons below to get started quickly.`,
    ]);

    const tips = joinWithNewlines([
      fmt`${emoji("rocket")} ${b}Pro Tip${b}`,
      fmt`You can use this feature in ${b}any chat${b} - groups, channels, or private messages! The prefix helps you search specific types of content.`,
    ]);

    const fullMessage = joinWithNewlines(
      [title, description, searchTypes, howToUse, tips],
      2
    );

    // Create inline keyboard with three search type buttons (one per row)
    const keyboard = INLINE_SEARCH_HELP_KEYBOARD;

    await ctx.reply(fullMessage.text, {
      entities: fullMessage.entities,
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
  }
);
