import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { fmt } from "@grammyjs/parse-mode";
import { combineFormattedDouble } from "../../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import { InlineKeyboard } from "grammy";

export const codeCommand = new Command<BotContext>(
  "code",
  `${emoji("laptop")} View the bot source code and license information`,
  async ctx => {
    const license = fmt`This bot is fully open source under GPL 3.0 ${emoji("high_voltage")}`;
    const repository = fmt`Check out the source code on GitHub`;
    const starRequest = fmt`${emoji("star")} Liked the bot? Consider giving it a star!`;
    const issues = fmt`${emoji("bug")} Found a bug or have a feature request? Open an issue on GitHub!`;

    const message = combineFormattedDouble([
      license,
      repository,
      starRequest,
      issues,
    ]);

    const keyboard = new InlineKeyboard()
      .url(
        `${emoji("laptop")} Source Code`,
        "https://github.com/devadathanmb/ktu-bot"
      )
      .url(
        `${emoji("handshake")} Feature Requests / Bug Reports`,
        "https://github.com/devadathanmb/ktu-bot/issues"
      );

    await ctx.reply(message.text, {
      entities: message.entities,
      reply_markup: keyboard,
    });
  }
);
