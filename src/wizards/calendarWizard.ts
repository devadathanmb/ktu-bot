import { Composer, Markup, Scenes } from "telegraf";
import { CustomContext } from "types/customContext.type";
import fetchAcademicCalendars from "services/fetchAcademicCalendars";
import fetchAttachment from "services/fetchAttachment";
import { AcademicCalendar } from "types/types";
import deleteMessage from "utils/deleteMessage";
import handleError from "wizards/utils/wizardErrorHandler";
import { callbackQuery } from "telegraf/filters";
import handlePageCommand from "wizards/utils/handlePageCommand";
import handleCancelCommand from "wizards/utils/handleCancelCommand";
import handleMyChatMember from "wizards/utils/handleMyChatMember";
import { InlineKeyboardButton } from "telegraf/types";
import shortenString from "@/wizards/utils/shortenString";

/*
  - Academic calendar lookup is also desinged as a WizardScene.
  - This wizard only has two steps. The first step fetches the calendars and displays them to the user.
    And the second step fetches the selected calendar and sends it to the user.
  - Previous and next buttons are also available to navigate through the calendars.

  - Just like in /result wizard, only /cancel command is defined to work inside the wizard. No other commands will work inside the wizard.
*/

const academicCalendarWizard = new Scenes.WizardScene<CustomContext>(
  "academic-calendar-wizard",

  // Wizard Step 0
  async (ctx: CustomContext) => {
    try {
      if (ctx.scene.session.pageNumber === undefined) {
        ctx.scene.session.pageNumber = 0;
      }
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
        return await ctx.scene.leave();
      }
      await ctx.answerCbQuery();
      if (!ctx.callbackQuery.data.startsWith("calendar")) {
        return await ctx.reply("Please choose a valid option");
      }
      const chosenCalendarId = Number.parseInt(
        ctx.callbackQuery.data.split("_")[1]
      );

      if (!chosenCalendarId) {
        return await ctx.reply("Please choose a valid option");
      }

      const chosenCalendar: AcademicCalendar = ctx.scene.session.calendars.find(
        (calendar: AcademicCalendar) => calendar.id === chosenCalendarId
      )!;

      await deleteMessage(ctx, ctx.scene.session.tempMsgId);
      ctx.scene.session.tempMsgId = null;
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
        await ctx.replyWithHTML("View another calendar?", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Yes ✅",
                  callback_data: "check_another_calendar_true",
                },
                {
                  text: "No ❌",
                  callback_data: "check_another_calendar_false",
                },
              ],
            ],
          },
        });
        return;
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
      await ctx.replyWithHTML("View another calendar?", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Yes ✅",
                callback_data: "check_another_calendar_true",
              },
              {
                text: "No ❌",
                callback_data: "check_another_calendar_false",
              },
            ],
          ],
        },
      });
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
    let calendarMsg = "<b>Academic calendars</b>:\n\n";
    let calendarButtons: InlineKeyboardButton.CallbackButton[] = [];

    calendars.forEach(({ id, title }, index) => {
      calendarMsg += `${index + 1}) ${shortenString(title)}\n\n`;
      calendarButtons.push(
        Markup.button.callback(`${index + 1}`, `calendar_${id}`)
      );
    });

    calendarMsg += `<b>• <i>Choose an academic calendar using the buttons below</i></b>\n\n`;
    calendarMsg += `<b>• <i>Use <code>/page pageno</code> to jump to a specific page</i></b>`;

    const nextPageButton = Markup.button.callback("Next ⏭️", "next_page");
    const prevPageButton = Markup.button.callback("Prev ⏮️", "prev_page");
    const pageInfoButton = Markup.button.callback(
      `Page : ${ctx.scene.session.pageNumber + 1}`,
      "page"
    );
    const keyboard = Markup.inlineKeyboard(
      [...calendarButtons, prevPageButton, pageInfoButton, nextPageButton],
      {
        wrap(btn, index, _currentRow) {
          if (!isNaN(Number(btn.text))) {
            if (index % 5 === 0) {
              return true;
            }
            return false;
          } else if (btn === prevPageButton) {
            return true;
          }
          return false;
        },
      }
    );
    await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
    ctx.scene.session.waitingMsgId = null;
    const msg = await ctx.sendMessage(calendarMsg, {
      parse_mode: "HTML",
      ...keyboard,
    });
    ctx.scene.session.tempMsgId = msg.message_id;
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
  try {
    if (ctx.scene.session.pageNumber == 0) {
      await ctx.answerCbQuery();
      return await ctx.reply("You are already on the first page.");
    }
    ctx.scene.session.pageNumber--;
    await deleteMessage(ctx, ctx.scene.session.tempMsgId);
    ctx.scene.session.tempMsgId = null;
    await showAcademicCalendars(ctx);
    return await ctx.answerCbQuery();
  } catch (error) {
    await handleError(ctx, error);
  }
});

// Next page button action : Increment page number and show academic calendars
academicCalendarWizard.action("next_page", async (ctx) => {
  try {
    ctx.scene.session.pageNumber++;
    await deleteMessage(ctx, ctx.scene.session.tempMsgId);
    ctx.scene.session.tempMsgId = null;
    await showAcademicCalendars(ctx);
    return await ctx.answerCbQuery();
  } catch (error) {
    await handleError(ctx, error);
  }
});

academicCalendarWizard.command("cancel", async (ctx) => {
  try {
    await handleCancelCommand(
      ctx,
      "Academic calendar look up cancelled.\n\nPlease use /calendar to start again."
    );
  } catch (error) {
    await handleError(ctx, error);
  }
});

// Quick page jump
academicCalendarWizard.command("page", async (ctx) => {
  try {
    await handlePageCommand(ctx, deleteMessage, showAcademicCalendars);
  } catch (error) {
    await handleError(ctx, error);
  }
});

academicCalendarWizard.action(
  "check_another_calendar_true",
  async (ctx, _next) => {
    try {
      await ctx.answerCbQuery();
      ctx.scene.session.tempMsgId = null;
      await deleteMessage(ctx, ctx.msgId!);
      ctx.wizard.selectStep(0);
      return Composer.unwrap(ctx.wizard.step!)(ctx, _next);
    } catch (error) {
      await handleError(ctx, error);
    }
  }
);

academicCalendarWizard.action("check_another_calendar_false", async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply(
      "Academic calendar lookup ended. Use /calendar to start again."
    );
    await deleteMessage(ctx, ctx.msgId!);
    await ctx.scene.leave();
  } catch (error) {
    await handleError(ctx, error);
  }
});

academicCalendarWizard.on("my_chat_member", handleMyChatMember);

export default academicCalendarWizard;
