import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { fmt } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import { InlineKeyboard } from "grammy";
import { coreCommand } from "./registry.js";

const metadata = coreCommand("code");

export const codeCommand = new Command<BotContext>(
  metadata.name,
  metadata.description,
  async ctx => {
    const license = fmt`${emoji("laptop")} KTU Bot is open source, licensed under AGPL-3.0.`;
    const issues = fmt`${emoji("bug")} View the code or report a bug using the buttons below.`;

    const message = joinWithNewlines([license, issues], 2);

    const keyboard = new InlineKeyboard()
      .url(
        `${emoji("laptop")} Source Code`,
        "https://github.com/devadathanmb/ktu-bot"
      )
      .url(
        `${emoji("bug")} Report a bug / Request a feature`,
        "https://github.com/devadathanmb/ktu-bot/issues"
      );

    await ctx.reply(message.text, {
      entities: message.entities,
      reply_markup: keyboard,
    });
  }
);
