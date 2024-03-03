import { Markup, Scenes } from "telegraf";
import { CustomContext } from "@/types/customContext.type";
import { callbackQuery, message } from "telegraf/filters";
import fetchCourses from "@/services/fetchCourses";
import fetchPublishedResults from "@/services/fetchPublishedResults";
import { fetchResult } from "@/services/fetchResult";
import formatDob from "@/utils/formatDob";
import formatResultMessage from "@/utils/formatResultMessage";
import formatSummaryMessage from "@/utils/formatSummaryMessage";
import calculateSgpa from "@/utils/calculateSgpa";
import deleteMessage from "@/utils/deleteMessage";
import handleError from "@/utils/handleError";

/*
  - Result lookup is designed as a WizardScene. This is similar to how an installation wizards works.
  - Only /cancel command is defined to work inside the wizard. No other commands will work inside the wizard.
  - Each wizard step shows a result window, which collects the required data for final result lookup.
  - The progress from one wizard step to another is based on user response. Each user update, takes the wizard one step forward.
  - So checks of user update should be done in the next step, not in the current step.
  - After each step, the sent messages are deleted to keep the chat clean and avoid confusion.

  - In case, the user does not perform the expected action (like not clicking button instead sending text), 
  the wizard will be stuck in the same step and will keep asking for the expected action.

  - /cancel command will delete all the messages sent by the wizard and will leave the wizard.

*/

/*
  - The below wizard has 5 steps. Starting from 0 to 4.

  - Step 0 -> Step 1 -> Step 2 -> Step 3 -> Step 4

  - Step 0 : Fetch available courses and show them as buttons 
  - Step 1 : Handle user's course selection and fetch available results and show them as buttons
  - Step 2 : Handle user's result selection and ask for registration number
  - Step 3 : Handle user's registration number response and ask for date of birth
  - Step 4 : Handle user's date of birth response and fetch the result and show it to the user. And leave the wizard.

  - Step 1, 2, 3 and 4 have a back button to go back to the previous step, which is handled in the corresponding steps.
*/

const handleCancelCommand = async (ctx: CustomContext) => {
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
  await deleteMessage(ctx, ctx.scene.session.courseMsgId);
  await deleteMessage(ctx, ctx.scene.session.resultMsgId);
  await deleteMessage(ctx, ctx.scene.session.regMsgId);
  await deleteMessage(ctx, ctx.scene.session.dobMsgId);
  await ctx.reply(
    "Result look up cancelled.\n\nPlease use /result to start again."
  );
  return await ctx.scene.leave();
};

const resultWizard = new Scenes.WizardScene<CustomContext>(
  "result-wizard",

  // Wizard Step 0
  async (ctx: CustomContext) => {
    try {
      const waitingMsg = await ctx.reply(
        "Fetching available courses.. Please wait.."
      );
      ctx.scene.session.waitingMsgId = waitingMsg.message_id;
      const courses = await fetchCourses();
      await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
      const courseButtons = courses.map(({ id, name }) =>
        Markup.button.callback(name, `course_${id}`)
      );
      const keyboard = Markup.inlineKeyboard(courseButtons, { columns: 1 });
      const msg = await ctx.sendMessage("Choose a course:", keyboard);
      ctx.scene.session.courseMsgId = msg.message_id;
      return ctx.wizard.next();
    } catch (error) {
      return await handleError(ctx, error);
    }
  },

  // Wizard Step 1
  async (ctx) => {
    if (ctx.message) {
      return await ctx.reply(
        "Please use the buttons to choose a result.\n\nUse /cancel to cancel result lookup."
      );
    }
    await deleteMessage(ctx, ctx.scene.session.courseMsgId);
    let courseId: number;
    if (ctx.has(callbackQuery("data"))) {
      if (ctx.callbackQuery.data === "back_to_1") {
        courseId = ctx.scene.session.courseId;
      } else {
        courseId = Number.parseInt(ctx.callbackQuery.data.split("_")[1]);
        ctx.scene.session.courseId = courseId;
      }
    } else {
      await ctx.reply("An error occured. Please try again.");
      return ctx.scene.leave();
    }
    try {
      const waitingMsg = await ctx.reply(
        "Fetching available results.. Please wait.."
      );
      ctx.scene.session.waitingMsgId = waitingMsg.message_id;
      const publishedResults = await fetchPublishedResults(courseId);
      deleteMessage(ctx, ctx.scene.session.waitingMsgId);
      const resultButtons = publishedResults.map(
        ({ resultName, examDefId, schemeId }) =>
          Markup.button.callback(resultName, `${examDefId}_${schemeId}`)
      );

      const goBackButton = Markup.button.callback("🔙 Back", "back_to_0");

      const keyboard = Markup.inlineKeyboard([...resultButtons, goBackButton], {
        columns: 1,
      });
      const msg = await ctx.sendMessage("Choose a result:", keyboard);
      ctx.scene.session.resultMsgId = msg.message_id;
      return ctx.wizard.next();
    } catch (error) {
      return await handleError(ctx, error);
    }
  },

  // Wizard Step 2
  async (ctx) => {
    if (ctx.message) {
      return await ctx.reply("Please choose a valid option");
    }

    await deleteMessage(ctx, ctx.scene.session.resultMsgId);
    if (
      ctx.has(callbackQuery("data")) &&
      ctx.callbackQuery.data === "back_to_0"
    ) {
      ctx.wizard.selectStep(0);

      if (typeof ctx.wizard.step === "function") {
        return ctx.wizard.step(ctx, async () => {});
      }
    }
    if (!ctx.has(callbackQuery("data"))) {
      ctx.reply("An error occured. Please try again.");
      return ctx.scene.leave();
    }
    const [examDefId, schemeId] = ctx.callbackQuery.data.split("_");
    ctx.scene.session.examDefId = Number(examDefId);
    ctx.scene.session.schemeId = Number(schemeId);
    const msg = await ctx.reply("Please enter your KTU Registration Number", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔙 Back",
              callback_data: "back_to_1",
            },
          ],
        ],
      },
    });
    ctx.scene.session.regMsgId = msg.message_id;
    return ctx.wizard.next();
  },

  // Wizard Step 3
  async (ctx) => {
    await deleteMessage(ctx, ctx.scene.session.regMsgId);
    if (
      ctx.has(callbackQuery("data")) &&
      ctx.callbackQuery.data === "back_to_1"
    ) {
      ctx.wizard.selectStep(1);
      if (typeof ctx.wizard.step === "function") {
        return ctx.wizard.step(ctx, async () => {});
      }
    }

    if (!ctx.has(message("text"))) {
      return await ctx.reply("Please enter a valid registration number");
    }
    const regisNo: string = ctx.message.text;
    if (!regisNo) {
      return await ctx.reply("Please enter a valid registration number");
    }
    ctx.scene.session.regisNo = regisNo.toUpperCase();

    const msg = await ctx.replyWithHTML(
      "Please enter your Date of Birth\n\n<b>Format: DD/MM/YYYY</b> \n\n<b><i>Example: 01/01/2000</i></b>",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔙 Back",
                callback_data: "back_to_2",
              },
            ],
          ],
        },
      }
    );
    ctx.scene.session.dobMsgId = msg.message_id;
    return ctx.wizard.next();
  },

  // Wizard Step 4
  async (ctx) => {
    if (
      ctx.has(callbackQuery("data")) &&
      ctx.callbackQuery.data === "back_to_2"
    ) {
      ctx.wizard.selectStep(2);

      await deleteMessage(ctx, ctx.scene.session.dobMsgId);
      if (typeof ctx.wizard.step === "function") {
        return ctx.wizard.step(ctx, async () => {});
      }
    }
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
    await deleteMessage(ctx, ctx.scene.session.dobMsgId);
    ctx.scene.session.dob = dob;
    try {
      const waitingMsg = await ctx.reply("Fetching result.. Please wait..");
      ctx.scene.session.waitingMsgId = waitingMsg.message_id;
      const { summary, resultDetails } = await fetchResult(
        ctx.scene.session.dob,
        ctx.scene.session.regisNo,
        ctx.scene.session.examDefId,
        ctx.scene.session.schemeId
      );

      const sgpa = calculateSgpa(resultDetails);
      await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
      await ctx.replyWithHTML(formatSummaryMessage(summary));
      await ctx.replyWithHTML(formatResultMessage(resultDetails, sgpa));
      return ctx.scene.leave();
    } catch (error) {
      return await handleError(ctx, error);
    }
  }
);
resultWizard.command("cancel", handleCancelCommand);

export default resultWizard;
