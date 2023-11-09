import { CustomContext } from "../types/customContext.type";
import { ChosenInlineResult, InlineQueryResult } from "telegraf/types";
import fetchAnnouncements from "../services/fetchAnnouncements";
import fetchAttachment from "../services/fetchAttachment";
import { Telegraf } from "telegraf";

async function searchInlineQueryHandler(ctx: CustomContext) {
  const query = ctx.inlineQuery?.query;
  const announcements = await fetchAnnouncements(0, 10, query);

  const results: InlineQueryResult[] = announcements.map((announcement) => ({
    type: "article",
    id: announcement.id.toString(),
    title: announcement.subject,
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
  await ctx.answerInlineQuery(results, { cache_time: 0 });
}

async function inlineQueryResltHandler(
  chosenInlineResult: ChosenInlineResult,
  bot: Telegraf<CustomContext>,
) {
  const query = chosenInlineResult.query;
  const id = chosenInlineResult.result_id;
  if (id === "-1") {
    return;
  }
  const chatId = chosenInlineResult.from.id;
  const waitingMsgId = await bot.telegram
    .sendMessage(chatId, "Fetching attachments.. Please wait..")
    .then((msg) => msg.message_id);
  const announcements = await fetchAnnouncements(0, 10, query);
  const chosenAnnouncement = announcements.find(
    (announcement) => announcement.id === Number(id),
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

  try {
    await bot.telegram.deleteMessage(chatId, waitingMsgId);
  } catch (error) {}
}

export { searchInlineQueryHandler, inlineQueryResltHandler };
