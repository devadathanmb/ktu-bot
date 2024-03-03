import { Markup, Scenes } from "telegraf";
import { CustomContext } from "@/types/customContext.type";
import fetchAcademicCalendars from "@/services/fetchAcademicCalendars";
import fetchAttachment from "@/services/fetchAttachment";
import { AcademicCalendar } from "@/types/types";
import deleteMessage from "@/utils/deleteMessage";
import handleError from "@/utils/handleError";
import { callbackQuery } from "telegraf/filters";

/*
  - Academic calendar lookup is also desinged as a WizardScene.
  - This wizard only has two steps. The first step fetches the calendars and displays them to the user.
    And the second step fetches the selected calendar and sends it to the user.
  - Previous and next buttons are also available to navigate through the calendars.

  - Just like in /result wizard, only /cancel command is defined to work inside the wizard. No other commands will work inside the wizard.
*/

const handleCancelCommand = async (ctx: CustomContext) => {
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
  await deleteMessage(ctx, ctx.scene.session.calendarMsgId);
  await ctx.reply(
    "Academic calendar look up cancelled.\n\nPlease use /calendar to start again."
  );
  return await ctx.scene.leave();
};

const academicCalendarWizard = new Scenes.WizardScene<CustomContext>(
  "academic-calendar-wizard",

  // Wizard Step 0
  async (ctx: CustomContext) => {
    try {
      ctx.scene.session.pageNumber = 0;
      await showAcademicCalendars(ctx);
      return ctx.wizard.next();
    } catch (error: any) {
      return await handleError(ctx, error);
    }
  },

  // Wizard Step 1
  async (ctx) => {
    if (ctx.message) {
      return await ctx.reply(
        "Please use the buttons to choose a academic calendar.\n\nUse /cancel to cancel academic calendar lookup."
      );
    }
    try {
      if (!ctx.has(callbackQuery("data"))) {
        await ctx.reply("An error occured. Please try again.");
        return ctx.scene.leave();
      }
      const chosenCalendarId = Number.parseInt(
        ctx.callbackQuery.data.split("_")[1]
      );
      const chosenCalendar: AcademicCalendar = ctx.scene.session.calendars.find(
        (calendar: AcademicCalendar) => calendar.id === chosenCalendarId
      );

      await ctx.deleteMessage(ctx.scene.session.calendarMsgId);
      const waitingMsg = await ctx.reply(
        "Fetching academic calendar.. Please wait.."
      );
      ctx.scene.session.waitingMsgId = waitingMsg.message_id;

      const file = await fetchAttachment(chosenCalendar.encryptId);
      const fileBuffer = Buffer.from(file, "base64");

      const captionMsg = `
<b>Title:</b> ${chosenCalendar.title}

<b>Date:</b> ${chosenCalendar.date}
`;

      // Some academic calendars do not have attachments
      if (!chosenCalendar.attachmentId) {
        await ctx.reply("No attachment found for this academic calendar.");
        await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
        return await ctx.scene.leave();
      }

      await ctx.replyWithDocument(
        {
          source: fileBuffer,
          filename: chosenCalendar.attachmentName,
        },
        {
          caption: captionMsg,
          parse_mode: "HTML",
        }
      );

      await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
      return await ctx.scene.leave();
    } catch (error) {
      return await handleError(ctx, error);
    }
  }
);

async function showAcademicCalendars(ctx: CustomContext) {
  try {
    const waitingMsg = await ctx.reply(
      "Fetching academic calendars.. Please wait.."
    );
    ctx.scene.session.waitingMsgId = waitingMsg.message_id;
    const calendars = await fetchAcademicCalendars(
      ctx.scene.session.pageNumber,
      10
    );
    const calendarButtons = calendars.map(({ id, title }) =>
      Markup.button.callback(title, `calendar_${id}`)
    );
    const nextPageButton = Markup.button.callback("Next ⏭️", "next_page");
    const prevPageButton = Markup.button.callback("Prev ⏮️", "prev_page");
    const pageInfoButton = Markup.button.callback(
      `Page : ${ctx.scene.session.pageNumber + 1}`,
      "page"
    );
    const keyboard = Markup.inlineKeyboard(
      [...calendarButtons, prevPageButton, pageInfoButton, nextPageButton],
      {
        wrap(_btn, _index, currentRow) {
          if (!currentRow.includes(prevPageButton)) {
            return true;
          }
          return false;
        },
      }
    );
    await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
    const msg = await ctx.sendMessage("Choose an academic calendar:", keyboard);
    ctx.scene.session.calendarMsgId = msg.message_id;
    ctx.scene.session.calendars = calendars;
  } catch (error) {
    await handleError(ctx, error);
  }
}

// Page number button action : Do nothing
academicCalendarWizard.action("page", async (ctx) => {
  await ctx.answerCbQuery();
});

// Previous page button action : Decrement page number and show academic calendars
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

// Next page button action : Increment page number and show academic calendars
academicCalendarWizard.action("next_page", async (ctx) => {
  ctx.scene.session.pageNumber++;
  await ctx.deleteMessage(ctx.scene.session.calendarMsgId);
  await showAcademicCalendars(ctx);
  return await ctx.answerCbQuery();
});

academicCalendarWizard.command("cancel", handleCancelCommand);

export default academicCalendarWizard;
