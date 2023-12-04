import { Markup, Scenes } from "telegraf";
import { CustomContext } from "../types/customContext.type";
import fetchAcademicCalendars from "../services/fetchAcademicCalendars";
import fetchAttachment from "../services/fetchAttachment";
import { AcademicCalendar } from "../types/types";
import deleteMessage from "../utils/deleteMessage";
import handleError from "../utils/handleError";

const handleCancelCommand = async (ctx: CustomContext) => {
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
  await deleteMessage(ctx, ctx.scene.session.calendarMsgId);
  await ctx.reply(
    "Academic calendar look up cancelled.\n\nPlease use /calendar to start again.",
  );
  return await ctx.scene.leave();
};

const academicCalendarWizard = new Scenes.WizardScene<CustomContext>(
  "academic-calendar-wizard",
  async (ctx: CustomContext) => {
    try {
      ctx.scene.session.pageNumber = 0;
      await showAcademicCalendars(ctx);
      return ctx.wizard.next();
    } catch (error: any) {
      return await handleError(ctx, error);
    }
  },
  async (ctx) => {
    if (ctx.message) {
      return await ctx.reply(
        "Please use the buttons to choose a academic calendar.\n\nUse /cancel to cancel academic calendar lookup.",
      );
    }
    try {
      const chosenCalendarId = Number.parseInt(
        (ctx.callbackQuery as any)?.data?.split("_")[1],
      );
      const chosenCalendar: AcademicCalendar = ctx.scene.session.calendars.find(
        (calendar: AcademicCalendar) => calendar.id === chosenCalendarId,
      );

      await ctx.deleteMessage(ctx.scene.session.calendarMsgId);
      const waitingMsg = await ctx.reply(
        "Fetching academic calendar.. Please wait..",
      );
      ctx.scene.session.waitingMsgId = waitingMsg.message_id;

      const file = await fetchAttachment(chosenCalendar.encryptId);
      const fileBuffer = Buffer.from(file, "base64");

      const captionMsg = `
<b>Title:</b> ${chosenCalendar.title}

<b>Date:</b> ${chosenCalendar.date}
`;

      await ctx.replyWithDocument(
        {
          source: fileBuffer,
          filename: chosenCalendar.attachmentName,
        },
        {
          caption: captionMsg,
          parse_mode: "HTML",
        },
      );

      await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
      return await ctx.scene.leave();
    } catch (error) {
      return await handleError(ctx, error);
    }
  },
);

async function showAcademicCalendars(ctx: CustomContext) {
  try {
    const waitingMsg = await ctx.reply(
      "Fetching academic calendars.. Please wait..",
    );
    ctx.scene.session.waitingMsgId = waitingMsg.message_id;
    const calendars = await fetchAcademicCalendars(
      ctx.scene.session.pageNumber,
      10,
    );
    const calendarButtons = calendars.map(({ id, title }: any) => ({
      text: title,
      callback_data: `calendar_${id}`,
    }));
    const nextPageButton = Markup.button.callback("Next Page", "next_page");
    const prevPageButton = Markup.button.callback("Previous Page", "prev_page");
    const keyboard = Markup.inlineKeyboard(
      [...calendarButtons, nextPageButton, prevPageButton],
      {
        columns: 1,
      },
    );
    await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
    const msg = await ctx.sendMessage("Choose an academic calendar:", keyboard);
    ctx.scene.session.calendarMsgId = msg.message_id;
    ctx.scene.session.calendars = calendars;
  } catch (error) {
    await handleError(ctx, error);
  }
}

academicCalendarWizard.action("prev_page", async (ctx) => {
  if (ctx.scene.session.pageNumber == 0) {
    await ctx.answerCbQuery();
    return await ctx.reply("You are already on the first page.");
  }
  ctx.scene.session.pageNumber--;
  await ctx.deleteMessage(ctx.scene.session.calendarMsgId);
  await showAcademicCalendars(ctx);
  return await ctx.answerCbQuery();
});

academicCalendarWizard.action("next_page", async (ctx) => {
  ctx.scene.session.pageNumber++;
  await ctx.deleteMessage(ctx.scene.session.calendarMsgId);
  await showAcademicCalendars(ctx);
  return await ctx.answerCbQuery();
});

academicCalendarWizard.command("cancel", (ctx) => handleCancelCommand(ctx));

export default academicCalendarWizard;
