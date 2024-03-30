import { CustomContext } from "types/customContext.type";
import { Markup, Scenes } from "telegraf";
import { fetchAllOldResults, fetchOldResults } from "services/fetchOldResults";
import { COURSES } from "constants/constants";
import { InlineKeyboardButton } from "telegraf/types";
import handleError from "./utils/wizardErrorHandler";
import { callbackQuery, message } from "telegraf/filters";
import deleteMessage from "utils/deleteMessage";
import handleCancelCommand from "./utils/handleCancelCommand";
import shortenString from "./utils/shortenString";
import formatDob from "utils/formatDob";
import { fetchResult } from "services/fetchResult";
import calculateSgpa from "utils/calculateSgpa";
import formatSummaryMessage from "utils/formatSummaryMessage";
import formatResultMessage from "utils/formatResultMessage";
import handlePageCommand from "./utils/handlePageCommand";

async function sendFinalResult(ctx: CustomContext) {
  const waitingMsg = await ctx.replyWithHTML(
    "Fetching result.. Please wait..\n\n<i>(This may take some time)</i>"
  );
  ctx.scene.session.waitingMsgId = waitingMsg.message_id;
  const { summary, resultDetails } = await fetchResult(
    ctx.scene.session.dob,
    ctx.scene.session.regisNo,
    ctx.scene.session.examDefId,
    ctx.scene.session.schemeId
  );

  const sgpa = calculateSgpa(resultDetails);
  await ctx.replyWithHTML(formatSummaryMessage(summary));
  const resultMessages = formatResultMessage(resultDetails, sgpa);
  for (let i = 0; i < resultMessages.length; i++) {
    await ctx.replyWithHTML(resultMessages[i]);
  }
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
}

async function showResults(ctx: CustomContext) {
  try {
    await fetchAllOldResults();
    const results = fetchOldResults(
      ctx.scene.session.courseName,
      ctx.scene.session.pageNumber
    );

    let resultMsg = "<b>Choose a result</b>:\n\n";
    let resultButtons: InlineKeyboardButton.CallbackButton[] = [];

    results.forEach(
      ({ resultName, examDefId, schemeId, publishDate }, index) => {
        resultMsg += `${index + 1}) ${shortenString(resultName)}\n\t\t\t\t\t(<i>Published date: ${publishDate}</i>)\n\n`;
        resultButtons.push(
          Markup.button.callback(`${index + 1}`, `${examDefId}_${schemeId}`)
        );
      }
    );

    resultMsg += `<b>• <i>Choose a result using the buttons below</i></b>\n\n`;
    resultMsg += `<b>• <i>Use <code>/page pageno</code> to jump to a specific page</i></b>`;

    const nextPageButton = Markup.button.callback("Next ⏭️", "next_page");
    const prevPageButton = Markup.button.callback("Prev ⏮️", "prev_page");
    const pageInfoButton = Markup.button.callback(
      `Page : ${ctx.scene.session.pageNumber + 1}`,
      "page"
    );
    const keyboard = Markup.inlineKeyboard(
      [...resultButtons, prevPageButton, pageInfoButton, nextPageButton],
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
    const msg = await ctx.sendMessage(resultMsg, {
      parse_mode: "HTML",
      ...keyboard,
    });
    ctx.scene.session.tempMsgId = msg.message_id;
    return;
  } catch (error) {
    return await handleError(ctx, error);
  }
}

const oldResultsWizard = new Scenes.WizardScene<CustomContext>(
  "old-results-wizard",

  async (ctx: CustomContext) => {
    try {
      let courseButtons: InlineKeyboardButton.CallbackButton[] = [];
      Object.keys(COURSES).forEach((key) => {
        courseButtons.push(Markup.button.callback(COURSES[key], key));
      });

      const keyboard = Markup.inlineKeyboard(courseButtons, { columns: 1 });
      const msg = await ctx.sendMessage("Choose a course:", {
        parse_mode: "HTML",
        ...keyboard,
      });
      ctx.scene.session.tempMsgId = msg.message_id;
      return ctx.wizard.next();
    } catch (error) {
      handleError(ctx, error);
    }
  },
  async (ctx: CustomContext) => {
    try {
      if (!ctx.has(callbackQuery("data"))) {
        return await ctx.reply("Please choose a course using buttons");
      }
      await ctx.answerCbQuery();
      await deleteMessage(ctx, ctx.scene.session.tempMsgId);
      const chosenCourse = ctx.callbackQuery.data;
      ctx.scene.session.courseName = chosenCourse;
      ctx.scene.session.pageNumber = 0;
      const msg = await ctx.reply("Fetching results.. Please wait..");
      ctx.scene.session.waitingMsgId = msg.message_id;
      await showResults(ctx);
      await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
      return ctx.wizard.next();
    } catch (error) {
      await handleError(ctx, error);
    }
  },
  async (ctx: CustomContext) => {
    try {
      if (!ctx.has(callbackQuery("data"))) {
        return await ctx.reply("Please choose a result using buttons");
      }
      await ctx.answerCbQuery();
      await deleteMessage(ctx, ctx.scene.session.tempMsgId);
      const [examDefId, schemeId] = ctx.callbackQuery.data.split("_");
      ctx.scene.session.examDefId = Number(examDefId);
      ctx.scene.session.schemeId = Number(schemeId);
      const msg = await ctx.reply("Please enter your KTU Registration Number");
      ctx.scene.session.tempMsgId = msg.message_id;
      return ctx.wizard.next();
    } catch (error) {
      await handleError(ctx, error);
    }
  },
  async (ctx: CustomContext) => {
    try {
      if (!ctx.has(message("text"))) {
        return await ctx.reply("Please enter a proper KTU Registration Number");
      }
      ctx.scene.session.regisNo = ctx.message.text;
      await deleteMessage(ctx, ctx.scene.session.tempMsgId);
      const msg = await ctx.replyWithHTML(
        "Please enter your Date of Birth\n\n<b>Format: DD/MM/YYYY</b> \n\n(<i>Example: 01/01/2000</i>)"
      );
      ctx.scene.session.tempMsgId = msg.message_id;
      return ctx.wizard.next();
    } catch (error) {
      await handleError(ctx, error);
    }
  },
  async (ctx: CustomContext) => {
    try {
      if (!ctx.has(message("text"))) {
        return await ctx.reply("Please enter a valid date of birth");
      }
      let dob: string = ctx.message.text;
      if (!dob) {
        return await ctx.reply("Please enter a valid date of birth");
      }
      try {
        dob = formatDob(dob);
      } catch (error) {
        return await ctx.reply("Please enter a valid date of birth");
      }
      await deleteMessage(ctx, ctx.scene.session.tempMsgId);
      await sendFinalResult(ctx);
      await ctx.scene.leave();
    } catch (error) {
      await handleError(ctx, error);
    }
  }
);

oldResultsWizard.command("cancel", async (ctx) => {
  await handleCancelCommand(
    ctx,
    "Result look up cancelled.\n\nPlease use /result to start again."
  );
});

// Page button action : Answer callback query and do nothing
oldResultsWizard.action("page", async (ctx) => {
  return await ctx.answerCbQuery();
});

// Previous page button action : Decrement page number and show results
oldResultsWizard.action("prev_page", async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.scene.session.pageNumber === 0) {
    return await ctx.reply("You are already on the first page.");
  }
  ctx.scene.session.pageNumber--;
  await deleteMessage(ctx, ctx.scene.session.tempMsgId);
  ctx.scene.session.tempMsgId = null;
  const msg = await ctx.reply("Fetching results.. Please wait..");
  await showResults(ctx);
  await deleteMessage(ctx, msg.message_id);
});

// Next page button action : Increment page number and show results
oldResultsWizard.action("next_page", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.session.pageNumber++;
  await deleteMessage(ctx, ctx.scene.session.tempMsgId);
  ctx.scene.session.tempMsgId = null;
  const msg = await ctx.reply("Fetching results.. Please wait..");
  await showResults(ctx);
  await deleteMessage(ctx, msg.message_id);
});

// Quick page jump
oldResultsWizard.command(
  "page",
  async (ctx) => await handlePageCommand(ctx, deleteMessage, showResults)
);

export default oldResultsWizard;
