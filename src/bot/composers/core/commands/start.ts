import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { fmt, b } from "@grammyjs/parse-mode";
import {
  formatCommand,
  joinWithNewlines,
} from "../../../../utils/formatting.js";
import { BotConfig } from "../../../../configs/bot.js";
import { emoji } from "@grammyjs/emoji";
import { helpCommand } from "./help.js";

export const startCommand = new Command<BotContext>(
  "start",
  `${emoji("high_voltage")} Start the bot and explore features`,
  async ctx => {
    const userName = ctx.from?.first_name || ctx.from?.username;
    const greeting = userName ? `Hello ${userName}!` : "Hello there!";
    const welcomeHeader = fmt`${greeting} ${emoji("waving_hand")}`;
    const welcomeMessage = fmt`${b}Welcome to KTU Bot!${b}`;
    const description = fmt`I can help you with announcements, academic calendar, exam timetables, notifications and more!`;
    const callToAction = fmt`Type ${b}${formatCommand(helpCommand)}${b} for more info.`;
    const thanks = fmt`Thank you for using KTU Bot! ${emoji("folded_hands")}`;

    const fullMessage = joinWithNewlines(
      [welcomeHeader, welcomeMessage, description, callToAction, thanks],
      2
    );

    await ctx.replyWithPhoto(BotConfig.BOT_IMAGE_URL, {
      caption: fullMessage.text,
      caption_entities: fullMessage.caption_entities,
    });
  }
);
