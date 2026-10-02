import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { fmt, b } from "@grammyjs/parse-mode";
import {
  formatCommand,
  joinWithNewlines,
} from "../../../../utils/formatting.js";
import { BotConfig } from "../../../../configs/bot.js";
import { emoji } from "@grammyjs/emoji";
import { coreCommand } from "./registry.js";

const metadata = coreCommand("start");

export const startCommand = new Command<BotContext>(
  metadata.name,
  metadata.description,
  async ctx => {
    const userName = ctx.from?.first_name || ctx.from?.username;
    const greeting = userName ? `Hi ${userName}!` : "Hi!";
    const welcomeHeader = fmt`${greeting} ${emoji("waving_hand")}`;
    const welcomeMessage = fmt`${b}Welcome to KTU Bot!${b}`;
    const description = fmt`Find KTU syllabuses, announcements, academic calendars, and exam timetables. You can also subscribe to announcement notifications.`;
    const callToAction = fmt`Use ${formatCommand(coreCommand("help"))} to see the commands.`;

    const fullMessage = joinWithNewlines(
      [welcomeHeader, welcomeMessage, description, callToAction],
      2
    );

    await ctx.replyWithPhoto(BotConfig.BOT_IMAGE_URL, {
      caption: fullMessage.text,
      caption_entities: fullMessage.caption_entities,
    });
  }
);
