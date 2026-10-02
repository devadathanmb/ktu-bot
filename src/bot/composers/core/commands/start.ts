import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { fmt } from "@grammyjs/parse-mode";
import { formatCommand } from "../../../../utils/formatting.js";
import { BotConfig } from "../../../../configs/bot.js";
import { blocks, ICON, lines } from "../../../../utils/message-style.js";
import { coreCommand } from "./registry.js";

const metadata = coreCommand("start");

export const startCommand = new Command<BotContext>(
  metadata.name,
  metadata.description,
  async ctx => {
    const userName = ctx.from?.first_name || ctx.from?.username;
    const greeting = userName ? `Hi ${userName}!` : "Hi!";

    const message = blocks([
      fmt`${ICON.greeting} ${greeting} Welcome to KTU Bot.`,
      fmt`I help you find KTU documents without digging through the website:`,
      lines([
        fmt`${ICON.announcements} Announcements`,
        fmt`${ICON.calendars} Academic calendars`,
        fmt`${ICON.timetables} Exam timetables`,
        fmt`${ICON.syllabus} Syllabuses`,
      ]),
      fmt`${ICON.alertsOn} I can also message you when a new announcement is posted.`,
      fmt`Send ${formatCommand(coreCommand("help"))} to see all commands.`,
    ]);

    await ctx.replyWithPhoto(BotConfig.BOT_IMAGE_URL, {
      caption: message.text,
      caption_entities: message.entities,
    });
  }
);
