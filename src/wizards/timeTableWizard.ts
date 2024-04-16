import { Composer, Markup, Scenes } from "telegraf";
import { CustomContext } from "types/customContext.type";
import fetchAttachment from "services/fetchAttachment";
import fetchTimetables from "services/fetchTimetables";
import { Timetable } from "types/types";
import deleteMessage from "utils/deleteMessage";
import handleError from "wizards/utils/wizardErrorHandler";
import { callbackQuery } from "telegraf/filters";
import handlePageCommand from "wizards/utils/handlePageCommand";
import handleCancelCommand from "./utils/handleCancelCommand";
import handleMyChatMember from "./utils/handleMyChatMember";
import { InlineKeyboardButton } from "telegraf/types";
import shortenString from "@/wizards/utils/shortenString";

/*
  - Exam time table lookup is also desinged as a WizardScene.
  - This wizard only has two steps. The first step fetches the time tables and displays them to the user.
    And the second step fetches the selected time table and sends it to the user.
  - Previous and next buttons are also available to navigate through the time tables.

  - Just like in /result wizard, only /cancel command is defined to work inside the wizard. No other commands will work inside the wizard.
*/

const timetableWizard = new Scenes.WizardScene<CustomContext>(
  "timetable-wizard",

  // Wizard Step 0
  async (ctx: CustomContext) => {
    try {
      if (ctx.scene.session.pageNumber === undefined) {
        ctx.scene.session.pageNumber = 0;
      }
      await showTimetables(ctx);
      return ctx.wizard.next();
    } catch (error: any) {
      return await handleError(ctx, error);
    }
  },

  // Wizard Step 1
  async (ctx) => {
    try {
      if (ctx.message) {
        return await ctx.reply(
          "Please use the buttons to choose a time table.\n\nUse /cancel to cancel time table lookup."
        );
      }
      if (!ctx.has(callbackQuery("data"))) {
        return await ctx.scene.leave();
      }

      await ctx.answerCbQuery();
      if (!ctx.callbackQuery.data.startsWith("timetable")) {
        return await ctx.reply("Please choose a valid option");
      }
      const chosenTimetableid = Number.parseInt(
        ctx.callbackQuery.data.split("_")[1]
      );

      if (!chosenTimetableid) {
        return await ctx.reply("Please choose a valid option");
      }

      const chosenTimetable: Timetable = ctx.scene.session.timetables.find(
        (timetable: Timetable) => timetable.id === chosenTimetableid
      )!;

      await deleteMessage(ctx, ctx.scene.session.tempMsgId);
      ctx.scene.session.tempMsgId = null;
      const waitingMsg = await ctx.reply("Fetching time table.. Please wait..");
      ctx.scene.session.waitingMsgId = waitingMsg.message_id;

      // Some time tables do not have attachments
      if (!chosenTimetable.attachmentId) {
        await ctx.reply("No attachment found for this time table.");
        await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
        await ctx.replyWithHTML("View another time table?", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Yes ✅",
                  callback_data: "check_another_timetable_true",
                },
                {
                  text: "No ❌",
                  callback_data: "check_another_timetable_false",
                },
              ],
            ],
          },
        });

        return;
      }

      const file = await fetchAttachment(chosenTimetable.encryptId);
      const fileBuffer = Buffer.from(file, "base64");

      const captionMsg = `
<b>Title:</b> ${chosenTimetable.title}

<b>Date:</b> ${chosenTimetable.date}
`;

      await ctx.replyWithDocument(
        {
          source: fileBuffer,
          filename: chosenTimetable.fileName,
        },
        { caption: captionMsg, parse_mode: "HTML" }
      );

      await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
      await ctx.replyWithHTML("View another time table?", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Yes ✅",
                callback_data: "check_another_timetable_true",
              },
              {
                text: "No ❌",
                callback_data: "check_another_timetable_false",
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

// Function to show time tables to the user
async function showTimetables(ctx: CustomContext) {
  try {
    const waitingMsg = await ctx.reply("Fetching time tables.. Please wait..");
    ctx.scene.session.waitingMsgId = waitingMsg.message_id;
    const timetables = await fetchTimetables(ctx.scene.session.pageNumber, 10);

    let timetableMsg = "<b>Exam time tables</b>:\n\n";
    let timetableButtons: InlineKeyboardButton.CallbackButton[] = [];

    timetables.forEach(({ id, title }, index) => {
      timetableMsg += `${index + 1}) ${shortenString(title)}\n\n`;
      timetableButtons.push(
        Markup.button.callback(`${index + 1}`, `timetable_${id}`)
      );
    });

    timetableMsg += `<b>• <i>Choose an exam time table using the buttons below</i></b>\n\n`;
    timetableMsg += `<b>• <i>Use <code>/page pageno</code> to jump to a specific page</i></b>`;

    const nextPageButton = Markup.button.callback("Next ⏭️", "next_page");
    const prevPageButton = Markup.button.callback("Prev ⏮️", "prev_page");
    const pageButton = Markup.button.callback(
      `Page : ${ctx.scene.session.pageNumber + 1}`,
      "page"
    );
    const keyboard = Markup.inlineKeyboard(
      [...timetableButtons, prevPageButton, pageButton, nextPageButton],
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
    const msg = await ctx.sendMessage(timetableMsg, {
      parse_mode: "HTML",
      ...keyboard,
    });
    ctx.scene.session.tempMsgId = msg.message_id;
    ctx.scene.session.timetables = timetables;
  } catch (error) {
    await handleError(ctx, error);
  }
}

// Page number button action : Do nothing
timetableWizard.action("page", async (ctx) => {
  await ctx.answerCbQuery();
});

// Previous page button action : Decrement page number and show time tables
timetableWizard.action("prev_page", async (ctx) => {
  try {
    if (ctx.scene.session.pageNumber == 0) {
      await ctx.answerCbQuery();
      return await ctx.reply("You are already on the first page.");
    }
    ctx.scene.session.pageNumber--;
    await deleteMessage(ctx, ctx.scene.session.tempMsgId);
    ctx.scene.session.tempMsgId = null;
    await showTimetables(ctx);
    return await ctx.answerCbQuery();
  } catch (error) {
    await handleError(ctx, error);
  }
});

// Next page button action : Increment page number and show time tables
timetableWizard.action("next_page", async (ctx) => {
  try {
    ctx.scene.session.pageNumber++;
    await deleteMessage(ctx, ctx.scene.session.tempMsgId);
    ctx.scene.session.tempMsgId = null;
    await showTimetables(ctx);
    return await ctx.answerCbQuery();
  } catch (error) {
    await handleError(ctx, error);
  }
});

timetableWizard.command("cancel", async (ctx) => {
  try {
    await handleCancelCommand(
      ctx,
      "Time table look up cancelled.\n\nPlease use /timetable to start again."
    );
  } catch (error) {
    await handleError(ctx, error);
  }
});

// Quick page jump
timetableWizard.command("page", async (ctx) => {
  try {
    await handlePageCommand(ctx, deleteMessage, showTimetables);
  } catch (error) {
    await handleError(ctx, error);
  }
});

timetableWizard.action("check_another_timetable_true", async (ctx, _next) => {
  try {
    await ctx.answerCbQuery();
    ctx.scene.session.tempMsgId = null;
    await deleteMessage(ctx, ctx.msgId!);
    ctx.wizard.selectStep(0);
    return Composer.unwrap(ctx.wizard.step!)(ctx, _next);
  } catch (error) {
    await handleError(ctx, error);
  }
});

timetableWizard.action("check_another_timetable_false", async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply(
      "Academic timetable lookup ended. Use /timetable to start again."
    );
    await deleteMessage(ctx, ctx.msgId!);
    await ctx.scene.leave();
  } catch (error) {
    await handleError(ctx, error);
  }
});

timetableWizard.on("my_chat_member", handleMyChatMember);

export default timetableWizard;
