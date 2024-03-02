import { CustomContext } from "@/types/customContext.type";
import { ChosenInlineResult, InlineQueryResult } from "telegraf/types";
import fetchAnnouncements from "@/services/fetchAnnouncements";
import fetchAttachment from "@/services/fetchAttachment";
import { Telegraf, TelegramError } from "telegraf";
import ServerError from "@/errors/ServerError";

async function searchInlineQueryHandler(ctx: CustomContext) {
  try {
    const query = ctx.inlineQuery?.query;
    const announcements = await fetchAnnouncements(0, 10, query);

    const results: InlineQueryResult[] = announcements.map((announcement) => ({
      type: "article",
      id: announcement.id.toString(),
      title: announcement.subject,
      description: announcement.subject,
      input_message_content: {
        message_text: `<b>Subject</b> : ${
          announcement.subject ? announcement.subject : "N/A"
        }\n\n<b>Date</b> : ${announcement.date ? announcement.date : "N/A"}\n
<b>Message</b> : ${announcement.message ? announcement.message : "N/A"}`,
        parse_mode: "HTML",
      },
    }));
    if (results.length == 0) {
      results.push({
        type: "article",
        id: "-1",
        title: "No results found.",
        input_message_content: {
          message_text: "No results found.",
        },
      });
    }
    await ctx.answerInlineQuery(results);
  } catch (error) {
    if (error instanceof TelegramError) {
      console.log(error);
    } else if (error instanceof ServerError) {
      const errorResult: InlineQueryResult[] = [
        {
          type: "article",
          id: "-1",
          title:
            "KTU servers are having issues right now. Please try again later.",
          input_message_content: {
            message_text: error.message,
          },
        },
      ];
      await ctx.answerInlineQuery(errorResult);
    }
  }
}

async function inlineQueryResultHandler(
  chosenInlineResult: ChosenInlineResult,
  bot: Telegraf<CustomContext>
) {
  try {
    const query = chosenInlineResult.query;
    const id = chosenInlineResult.result_id;
    if (id === "-1") {
      return;
    }
    const chatId = chosenInlineResult.from.id;
    const waitingMsgId = await bot.telegram
      .sendMessage(chatId, "Fetching attachments.. Please wait..")
      .then((msg) => msg.message_id);
    const announcements = await fetchAnnouncements(0, 20, query);
    const chosenAnnouncement = announcements.find(
      (announcement) => announcement.id === Number(id)
    );
    const attachments = chosenAnnouncement!.attachments;
    if (attachments.length == 0) {
      await bot.telegram.sendMessage(chatId, "No attachments found.");
    }

    for (const attachment of attachments) {
      const file = await fetchAttachment(attachment.encryptId);
      const fileBuffer = Buffer.from(file, "base64");

      await bot.telegram.sendDocument(chatId, {
        source: fileBuffer,
        filename: attachment.name,
      });
    }

    await bot.telegram.deleteMessage(chatId, waitingMsgId);
  } catch (error) {
    if (error instanceof TelegramError) {
      console.log(error);
    } else if (error instanceof ServerError) {
      await bot.telegram.sendMessage(chosenInlineResult.from.id, error.message);
    }
  }
}

export { searchInlineQueryHandler, inlineQueryResultHandler };
