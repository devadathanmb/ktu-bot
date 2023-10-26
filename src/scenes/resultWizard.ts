import { Markup, Scenes } from "telegraf";
import ResultContext from "../types/resultContext";
import fetchCourses from "../services/fetchCourses";
import fetchPublishedResults from "../services/fetchPublishedResults";
import { fetchResult, InvalidDataError } from "../services/fetchResult";
import formatDob from "../utils/formatDob";
import formatResultMessage from "../utils/formatResultMessage";
import formatSummaryMessage from "../utils/formatSummaryMessage";
import calculateSgpa from "../utils/calculateSgpa";

const handleCancelCommand = async (ctx: ResultContext) => {
  try {
    await ctx.deleteMessage(ctx.session.courseMsgId);
    await ctx.deleteMessage(ctx.session.resultMsgId);
  } catch (error) {
  } finally {
    ctx.reply("Result look up cancelled. Please use /result to start again.");
    return ctx.scene.leave();
  }
};

const resultWizard = new Scenes.WizardScene<ResultContext>(
  "result-wizard",
  async (ctx: ResultContext) => {
    try {
      const courses = await fetchCourses();
      const courseButtons = courses.map(({ id, name }) => ({
        text: name,
        callback_data: `course_${id}`,
      }));
      const keyboard = Markup.inlineKeyboard(courseButtons, { columns: 1 });
      const msg = await ctx.sendMessage("Choose a course:", keyboard);
      ctx.session.courseMsgId = msg.message_id;
      return ctx.wizard.next();
    } catch (error) {
      return handleError(ctx, error);
    }
  },
  async (ctx) => {
    if (ctx.message) {
      return ctx.reply("Please choose a valid option");
    }
    try {
      await ctx.deleteMessage(ctx.session.courseMsgId);
    } catch (error) {}
    const courseId: number = Number.parseInt(
      (ctx.callbackQuery as any)?.data?.split("_")[1],
    );
    ctx.session.courseId = courseId;
    try {
      const publishedResults = await fetchPublishedResults(courseId);
      const resultButtons = publishedResults.map(
        ({ resultName, examDefId, schemeId }) => ({
          text: resultName,
          callback_data: `${examDefId}_${schemeId}`,
        }),
      );
      const keyboard = Markup.inlineKeyboard(resultButtons, { columns: 1 });
      const msg = await ctx.sendMessage("Choose a result:", keyboard);
      ctx.session.resultMsgId = msg.message_id;
      return ctx.wizard.next();
    } catch (error) {
      return handleError(ctx, error);
    }
  },
  async (ctx) => {
    if (ctx.message) {
      return ctx.reply("Please choose a valid option");
    }
    const [examDefId, schemeId] = (ctx.callbackQuery as any)?.data?.split("_");
    try {
      await ctx.deleteMessage(ctx.session.resultMsgId);
    } catch (error) {}
    ctx.session.examDefId = examDefId;
    ctx.session.schemeId = schemeId;
    await ctx.reply("Please enter your KTU Registration Number");
    return ctx.wizard.next();
  },
  async (ctx) => {
    const regisNo: string = (ctx.message as any)?.text;
    if (!regisNo) {
      return ctx.reply("Please enter a valid registration number");
    }
    ctx.session.regisNo = regisNo.toUpperCase();
    await ctx.reply("Please enter your Date of Birth (DD/MM/YYYY)");
    return ctx.wizard.next();
  },
  async (ctx) => {
    let dob: string = (ctx.message as any)?.text;
    if (!dob) {
      return ctx.reply("Please enter a valid date of birth");
    }
    try {
      dob = formatDob(dob);
    } catch (error) {
      return ctx.reply("Please enter a valid date of birth");
    }
    ctx.session.dob = dob;
    try {
      const { summary, resultDetails } = await fetchResult(
        ctx.session.dob,
        ctx.session.regisNo,
        ctx.session.examDefId,
        ctx.session.schemeId,
      );

      const sgpa = calculateSgpa(resultDetails);
      await ctx.replyWithHTML(formatSummaryMessage(summary));
      await ctx.replyWithHTML(formatResultMessage(resultDetails, sgpa));
      return ctx.scene.leave();
    } catch (error) {
      return handleError(ctx, error);
    }
  },
);

resultWizard.command("cancel", (ctx) => handleCancelCommand(ctx));

async function handleError(ctx: ResultContext, error: any) {
  if (error instanceof InvalidDataError) {
    await ctx.reply(
      "Invalid roll number or dob. Are you sure that the roll number and date of birth are correct?",
    );
    await ctx.reply("Please use /result to start again.");
    return ctx.scene.leave();
  }
  console.error(error);
  ctx.reply("Something went wrong. Please try again later.");
  return ctx.scene.leave();
}

export default resultWizard;
