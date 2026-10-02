import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { fmt } from "@grammyjs/parse-mode";
import { blocks } from "../../../../utils/message-style.js";
import { emoji } from "@grammyjs/emoji";
import { InlineKeyboard } from "grammy";
import { coreCommand } from "./registry.js";

const metadata = coreCommand("code");

export const codeCommand = new Command<BotContext>(
  metadata.name,
  metadata.description,
  async ctx => {
    const message = blocks([
      fmt`${emoji("laptop")} KTU Bot is open source under the AGPL-3.0 license.`,
      fmt`Browse the code or report a bug using the buttons below.`,
    ]);

    const keyboard = new InlineKeyboard()
      .url(
        `${emoji("laptop")} Source code`,
        "https://github.com/devadathanmb/ktu-bot"
      )
      .url(
        `${emoji("bug")} Report a bug or request a feature`,
        "https://github.com/devadathanmb/ktu-bot/issues"
      );

    await ctx.reply(message.text, {
      entities: message.entities,
      reply_markup: keyboard,
    });
  }
);
