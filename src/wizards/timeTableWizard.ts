import { Markup, Scenes } from "telegraf";
import { CustomContext } from "../types/customContext.type";
import fetchAttachment from "../services/fetchAttachment";
import fetchTimetables from "../services/fetchTimetables";
import { Timetable } from "../types/types";
import deleteMessage from "../utils/deleteMessage";
import handleError from "../utils/handleError";

const handleCancelCommand = async (ctx: CustomContext) => {
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
  await deleteMessage(ctx, ctx.scene.session.timetableMsgId);
  await ctx.reply(
    "Time table look up cancelled.\n\nPlease use /timetable to start again."
  );
  return await ctx.scene.leave();
};

const timetableWizard = new Scenes.WizardScene<CustomContext>(
  "timetable-wizard",
  async (ctx: CustomContext) => {
    try {
      ctx.scene.session.pageNumber = 0;
      await showTimetables(ctx);
      return ctx.wizard.next();
    } catch (error: any) {
      return await handleError(ctx, error);
    }
  },
  async (ctx) => {
    if (ctx.message) {
      return await ctx.reply(
        "Please use the buttons to choose a time table.\n\nUse /cancel to cancel time table lookup."
      );
    }
    try {
      const chosenTimetableid = Number.parseInt(
        (ctx.callbackQuery as any)?.data?.split("_")[1]
      );
      const chosenTimetable: Timetable = ctx.scene.session.timetables.find(
        (timetable: Timetable) => timetable.id === chosenTimetableid
      );

      await ctx.deleteMessage(ctx.scene.session.timetableMsgId);
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
    ctx.scene.session.timetableMsgId = msg.message_id;
    ctx.scene.session.timetables = timetables;
  } catch (error) {
    await handleError(ctx, error);
  }
}

timetableWizard.action("page", async (ctx) => {
  await ctx.answerCbQuery();
});

timetableWizard.action("prev_page", async (ctx) => {
  if (ctx.scene.session.pageNumber == 0) {
    await ctx.answerCbQuery();
    return await ctx.reply("You are already on the first page.");
  }
  ctx.scene.session.pageNumber--;
  await ctx.deleteMessage(ctx.scene.session.timetableMsgId);
  await showTimetables(ctx);
  return await ctx.answerCbQuery();
});

timetableWizard.action("next_page", async (ctx) => {
  ctx.scene.session.pageNumber++;
  await ctx.deleteMessage(ctx.scene.session.timetableMsgId);
  await showTimetables(ctx);
  return await ctx.answerCbQuery();
});

timetableWizard.command("cancel", handleCancelCommand);

export default timetableWizard;
