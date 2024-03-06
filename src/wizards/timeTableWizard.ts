import { Markup, Scenes } from "telegraf";
import { CustomContext } from "@/types/customContext.type";
import fetchAttachment from "@/services/fetchAttachment";
import fetchTimetables from "@/services/fetchTimetables";
import { Timetable } from "@/types/types";
import deleteMessage from "@/utils/deleteMessage";
import handleError from "@/utils/handleError";
import { callbackQuery } from "telegraf/filters";

/*
  - Exam time table lookup is also desinged as a WizardScene.
  - This wizard only has two steps. The first step fetches the time tables and displays them to the user.
    And the second step fetches the selected time table and sends it to the user.
  - Previous and next buttons are also available to navigate through the time tables.

  - Just like in /result wizard, only /cancel command is defined to work inside the wizard. No other commands will work inside the wizard.
*/

const handleCancelCommand = async (ctx: CustomContext) => {
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
  await deleteMessage(ctx, ctx.scene.session.tempMsgId);
  await ctx.reply(
    "Time table look up cancelled.\n\nPlease use /timetable to start again."
  );
  return await ctx.scene.leave();
};

const timetableWizard = new Scenes.WizardScene<CustomContext>(
  "timetable-wizard",

  // Wizard Step 0
  async (ctx: CustomContext) => {
    try {
      ctx.scene.session.pageNumber = 0;
      await showTimetables(ctx);
      return ctx.wizard.next();
    } catch (error: any) {
      return await handleError(ctx, error);
    }
  },

  // Wizard Step 1
  async (ctx) => {
    if (ctx.message) {
      return await ctx.reply(
        "Please use the buttons to choose a time table.\n\nUse /cancel to cancel time table lookup."
      );
    }
    try {
      if (!ctx.has(callbackQuery("data"))) {
        await ctx.reply("An error occured. Please try again.");
        return ctx.scene.leave();
      }
      const chosenTimetableid = Number.parseInt(
        ctx.callbackQuery.data.split("_")[1]
      );
      const chosenTimetable: Timetable = ctx.scene.session.timetables.find(
        (timetable: Timetable) => timetable.id === chosenTimetableid
      );

      await ctx.deleteMessage(ctx.scene.session.tempMsgId);
      const waitingMsg = await ctx.reply("Fetching time table.. Please wait..");
      ctx.scene.session.waitingMsgId = waitingMsg.message_id;

      // Some time tables do not have attachments
      if (!chosenTimetable.attachmentId) {
        await ctx.reply("No attachment found for this time table.");
        await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
        return await ctx.scene.leave();
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
      return await ctx.scene.leave();
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
    const timetableButtons = timetables.map(({ id, title }) =>
      Markup.button.callback(title, `timetable_${id}`)
    );
    const nextPageButton = Markup.button.callback("Next ⏭️", "next_page");
    const prevPageButton = Markup.button.callback("Prev ⏮️", "prev_page");
    const pageButton = Markup.button.callback(
      `Page : ${ctx.scene.session.pageNumber + 1}`,
      "page"
    );
    const keyboard = Markup.inlineKeyboard(
      [...timetableButtons, prevPageButton, pageButton, nextPageButton],
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
    const msg = await ctx.sendMessage("Choose a time table:", keyboard);
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
  if (ctx.scene.session.pageNumber == 0) {
    await ctx.answerCbQuery();
    return await ctx.reply("You are already on the first page.");
  }
  ctx.scene.session.pageNumber--;
  await ctx.deleteMessage(ctx.scene.session.tempMsgId);
  await showTimetables(ctx);
  return await ctx.answerCbQuery();
});

// Next page button action : Increment page number and show time tables
timetableWizard.action("next_page", async (ctx) => {
  ctx.scene.session.pageNumber++;
  await ctx.deleteMessage(ctx.scene.session.tempMsgId);
  await showTimetables(ctx);
  return await ctx.answerCbQuery();
});

timetableWizard.command("cancel", handleCancelCommand);

export default timetableWizard;
