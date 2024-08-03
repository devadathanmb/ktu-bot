import { Composer, Markup, Scenes } from "telegraf";
import { CustomContext } from "types/customContext.type";
import { callbackQuery, message } from "telegraf/filters";
import fetchCourses from "services/fetchCourses";
import fetchPublishedResults from "services/fetchPublishedResults";
import { fetchResult } from "services/fetchResult";
import formatDob from "utils/formatDob";
import formatResultMessage from "utils/formatResultMessage";
import formatSummaryMessage from "utils/formatSummaryMessage";
import calculateSgpa from "utils/calculateSgpa";
import deleteMessage from "utils/deleteMessage";
import handleError from "wizards/utils/wizardErrorHandler";
import handleCancelCommand from "wizards/utils/handleCancelCommand";
import ServerError from "errors/ServerError";
import logger from "utils/logger";
import handleMyChatMember from "./utils/handleMyChatMember";

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
  - The below wizard has 6 steps. Starting from 0 to 5

  - Step 0 -> Step 1 -> Step 2 -> Step 3 -> Step 4
  - Step 5 is an optional step, which is used to handle retry button click.

  - Step 0 : Fetch available courses and show them as buttons 
  - Step 1 : Handle user's course selection and fetch available results and show them as buttons
  - Step 2 : Handle user's result selection and ask for registration number
  - Step 3 : Handle user's registration number response and ask for date of birth
  - Step 4 : Handle user's date of birth response and fetch the result and show it to the user. And leave the wizard.
  - Step 5 : Handle retry button click [OPTIONAL]

  - Step 1, 2, 3 and 4 have a back button to go back to the previous step, which is handled in the corresponding steps.
  - Step 4 also has a retry button, which is handled as a separate step [step 5]
*/

// Helper function to fetch final result
async function sendFinalResult(ctx: CustomContext) {
  const waitingMsg = await ctx.replyWithHTML(
    "Fetching result.. Please wait..\n\n<i>(This may take some time)</i>"
  );
  ctx.scene.session.waitingMsgId = waitingMsg.message_id;
  const results = await fetchPublishedResults(ctx.scene.session.courseId);
  const targetResult = results.find(
    (result) => result.index === ctx.scene.session.index
  );
  const token = targetResult!.token;

  const { summary, resultDetails } = await fetchResult(
    ctx.scene.session.dob,
    ctx.scene.session.regisNo,
    token
  );

  const sgpa = calculateSgpa(resultDetails);
  await ctx.replyWithHTML(formatSummaryMessage(summary));
  const resultMessages = formatResultMessage(resultDetails, sgpa);
  for (let i = 0; i < resultMessages.length; i++) {
    await ctx.replyWithHTML(resultMessages[i]);
  }
  await ctx.replyWithHTML("Check another result?", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Yes ✅",
            callback_data: "check_another_result_true",
          },
          {
            text: "No ❌",
            callback_data: "check_another_result_false",
          },
        ],
      ],
    },
  });
  ctx.scene.session.tempMsgId = -1;
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
}

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
      ctx.scene.session.waitingMsgId = null;
      const courseButtons = courses.map(({ id, name }) =>
        Markup.button.callback(name, `course_${id}`)
      );
      const keyboard = Markup.inlineKeyboard(courseButtons, { columns: 1 });
      const msg = await ctx.sendMessage("Choose a course:", keyboard);
      ctx.scene.session.tempMsgId = msg.message_id;
      return ctx.wizard.next();
    } catch (error) {
      return await handleError(ctx, error);
    }
  },

  // Wizard Step 1
  async (ctx) => {
    try {
      if (ctx.message) {
        return await ctx.reply(
          "Please use the buttons to choose a result.\n\nUse /cancel to cancel result lookup."
        );
      }
      let courseId: number;

      if (
        ctx.updateType !== "callback_query" ||
        !ctx.has(callbackQuery("data")) ||
        !(
          ctx.callbackQuery.data.startsWith("course_") ||
          ctx.callbackQuery.data == "back_to_1"
        )
      ) {
        await ctx.reply("Unknown option selected. Use /result to start again.");
        return await ctx.scene.leave();
      }

      await ctx.answerCbQuery();
      if (ctx.callbackQuery.data === "back_to_1") {
        await deleteMessage(ctx, ctx.scene.session.tempMsgId);
        courseId = ctx.scene.session.courseId;
      } else if (ctx.callbackQuery.data.startsWith("course_")) {
        await deleteMessage(ctx, ctx.scene.session.tempMsgId);
        courseId = Number.parseInt(ctx.callbackQuery.data.split("_")[1]);
        ctx.scene.session.courseId = courseId;
      } else {
        return await ctx.reply("Please choose a valid course");
      }
      const waitingMsg = await ctx.reply(
        "Fetching available results.. Please wait.."
      );
      ctx.scene.session.waitingMsgId = waitingMsg.message_id;
      const publishedResults = await fetchPublishedResults(courseId);

      const resultButtons = publishedResults.map(({ resultName, index }) =>
        Markup.button.callback(resultName, `result_${index}`)
      );

      const goBackButton = Markup.button.callback("🔙 Back", "back_to_0");

      const keyboard = Markup.inlineKeyboard([...resultButtons, goBackButton], {
        columns: 1,
      });
      const msg = await ctx.sendMessage("Choose a result:", keyboard);
      await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
      ctx.scene.session.waitingMsgId = null;
      ctx.scene.session.tempMsgId = msg.message_id;
      return ctx.wizard.next();
    } catch (error) {
      return await handleError(ctx, error);
    }
  },

  // Wizard Step 2
  async (ctx, _next) => {
    try {
      if (ctx.message) {
        return await ctx.reply("Please choose a valid option");
      }

      if (ctx.updateType !== "callback_query") {
        await ctx.reply("Unknown option selected. Use /result to start again.");
        return await ctx.scene.leave();
      }

      await ctx.answerCbQuery();
      if (
        ctx.has(callbackQuery("data")) &&
        ctx.callbackQuery.data === "back_to_0"
      ) {
        ctx.wizard.selectStep(0);
        await deleteMessage(ctx, ctx.scene.session.tempMsgId);
        ctx.scene.session.tempMsgId = null;
        return Composer.unwrap(ctx.wizard.step!)(ctx, _next);
      }

      if (
        ctx.has(callbackQuery("data")) &&
        ctx.callbackQuery.data.startsWith("result_")
      ) {
        const [index] = ctx.callbackQuery.data.split("_").slice(1);
        ctx.scene.session.index = Number(index);

        if (!ctx.scene.session.index) {
          return await ctx.reply("Please choose a valid result");
        }
        await deleteMessage(ctx, ctx.scene.session.tempMsgId);
        ctx.scene.session.tempMsgId = null;
      }

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
      ctx.scene.session.tempMsgId = msg.message_id;
      return ctx.wizard.next();
    } catch (error) {
      await handleError(ctx, error);
    }
  },

  // Wizard Step 3
  async (ctx, _next) => {
    try {
      if (
        ctx.has(callbackQuery("data")) &&
        ctx.callbackQuery.data === "back_to_1"
      ) {
        await ctx.answerCbQuery();
        await deleteMessage(ctx, ctx.scene.session.tempMsgId);
        ctx.scene.session.tempMsgId = null;
        ctx.wizard.selectStep(1);
        return Composer.unwrap(ctx.wizard.step!)(ctx, _next);
      }

      if (!ctx.has(message("text"))) {
        return await ctx.reply("Please enter a valid registration number");
      }
      const regisNo: string = ctx.message.text;
      if (!regisNo) {
        return await ctx.reply("Please enter a valid registration number");
      }
      ctx.scene.session.regisNo = regisNo.toUpperCase();
      await deleteMessage(ctx, ctx.scene.session.tempMsgId);
      ctx.scene.session.tempMsgId = null;

      const msg = await ctx.replyWithHTML(
        "Please enter your Date of Birth\n\nFormat: DD/MM/YYYY \n\n(<i>Example: 01/01/2000</i>)",
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
      ctx.scene.session.tempMsgId = msg.message_id;
      return ctx.wizard.next();
    } catch (error) {
      await handleError(ctx, error);
    }
  },

  // Wizard Step 4
  async (ctx, _next) => {
    try {
      if (ctx.scene.session.tempMsgId === -1) {
        return await ctx.reply("Please click the buttons to choose an option.");
      }
      if (
        ctx.has(callbackQuery("data")) &&
        ctx.callbackQuery.data === "back_to_2"
      ) {
        await ctx.answerCbQuery();
        ctx.wizard.selectStep(2);

        await deleteMessage(ctx, ctx.scene.session.tempMsgId);
        ctx.scene.session.tempMsgId = null;
        return Composer.unwrap(ctx.wizard.step!)(ctx, _next);
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
      await deleteMessage(ctx, ctx.scene.session.tempMsgId);
      ctx.scene.session.tempMsgId = null;
      ctx.scene.session.dob = dob;
      try {
        await sendFinalResult(ctx);
      } catch (error) {
        await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
        ctx.scene.session.waitingMsgId = null;
        // If the error is a server error
        // Add a retry button along with the error message
        // If retry button clicked, go back and execute step 4 again
        if (error instanceof ServerError) {
          const retryMsg = await ctx.sendMessage(error.message, {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Retry 🔁",
                    callback_data: "retry",
                  },
                  {
                    text: "Cancel ❌",
                    callback_data: "cancel",
                  },
                ],
              ],
            },
          });
          ctx.scene.session.tempMsgId = retryMsg.message_id;
          return ctx.wizard.next();
        }
        return await handleError(ctx, error);
      }
    } catch (error) {
      await handleError(ctx, error);
    }
  },

  // Step 5 [OPTIONAL] : To handle retry result lookup, in case of a server error
  async (ctx: CustomContext) => {
    try {
      if (
        ctx.has(callbackQuery("data")) &&
        ctx.callbackQuery.data === "cancel"
      ) {
        await ctx.answerCbQuery();
        return await handleCancelCommand(
          ctx,
          "Result look up cancelled.\n\nPlease use /result to start again."
        );
      } else if (
        ctx.has(callbackQuery("data")) &&
        ctx.callbackQuery.data === "retry"
      ) {
        await ctx.answerCbQuery();
        await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
        await deleteMessage(ctx, ctx.scene.session.tempMsgId);
        ctx.scene.session.waitingMsgId = null;
        ctx.scene.session.tempMsgId = null;
        await ctx.reply(
          `Checking rersult of :\nREGNO: ${ctx.scene.session.regisNo}\nDOB: ${ctx.scene.session.dob}`
        );
        try {
          await sendFinalResult(ctx);
          await deleteMessage(ctx, ctx.scene.session.tempMsgId);
          return await ctx.scene.leave();
        } catch (error) {
          if (error instanceof ServerError) {
            await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
            ctx.scene.session.waitingMsgId = null;
            const retryMsg = await ctx.sendMessage(error.message, {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Retry 🔁",
                      callback_data: "retry",
                    },
                    {
                      text: "Cancel ❌",
                      callback_data: "cancel",
                    },
                  ],
                ],
              },
            });
            ctx.scene.session.tempMsgId = retryMsg.message_id;
            return;
          } else {
            return await handleError(ctx, error);
          }
        }
      } else {
        return await ctx.reply("Please click the buttons to choose an option.");
      }
    } catch (error) {
      await handleError(ctx, error);
    }
  }
);

resultWizard.action("check_another_result_true", async (ctx, _next) => {
  try {
    await ctx.answerCbQuery();
    ctx.scene.session.tempMsgId = null;
    await deleteMessage(ctx, ctx.msgId!);
    ctx.wizard.selectStep(2);
    return Composer.unwrap(ctx.wizard.step!)(ctx, _next);
  } catch (error) {
    logger.error(`Error in check_another_result_true: ${error}`);
  }
});

resultWizard.action("check_another_result_false", async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply("Result lookup ended. Use /result to start again.");
    await deleteMessage(ctx, ctx.msgId!);
    await ctx.scene.leave();
  } catch (error) {
    logger.error(`Error in check_another_result_false: ${error}`);
  }
});

resultWizard.command("cancel", async (ctx) => {
  try {
    await handleCancelCommand(
      ctx,
      "Result look up cancelled.\n\nPlease use /result to start again."
    );
  } catch (error) {
    await handleError(ctx, error);
  }
});

resultWizard.on("my_chat_member", handleMyChatMember);

export default resultWizard;
