import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { fmt, b, code } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import { INLINE_SEARCH_HELP_KEYBOARD } from "../../inline-query/keyboards.js";
import { BotConfig } from "../../../../configs/bot.js";
import { coreCommand } from "./registry.js";

const metadata = coreCommand("search");

export const searchCommand = new Command<BotContext>(
  metadata.name,
  metadata.description,
  async (ctx: BotContext) => {
    const title = fmt`${emoji("magnifying_glass_tilted_left")} ${b}Search KTU Resources${b}`;
    const botUsername = `@${BotConfig.BOT_USERNAME}`;
    const description = fmt`Search announcements, academic calendars, and exam timetables from any chat. Type ${code}${botUsername}${code} followed by your keywords, then choose a result.`;

    const searchTypes = joinWithNewlines([
      fmt`${emoji("books")} ${b}Search Types${b}`,
      joinWithNewlines(
        [
          joinWithNewlines([
            fmt`${emoji("loudspeaker")} ${b}Announcements${b}`,
            fmt`${code}${botUsername} ann: btech exam${code}`,
          ]),
          joinWithNewlines([
            fmt`${emoji("calendar")} ${b}Academic calendars${b}`,
            fmt`${code}${botUsername} cal: semester${code}`,
          ]),
          joinWithNewlines([
            fmt`${emoji("clipboard")} ${b}Exam timetables${b}`,
            fmt`${code}${botUsername} tt: btech s3${code}`,
          ]),
        ],
        2
      ),
    ]);

    const howToUse = fmt`${emoji("backhand_index_pointing_down")} Or choose a search type below.`;

    const fullMessage = joinWithNewlines(
      [title, description, searchTypes, howToUse],
      2
    );

    const keyboard = INLINE_SEARCH_HELP_KEYBOARD;

    await ctx.reply(fullMessage.text, {
      entities: fullMessage.entities,
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
  }
);
