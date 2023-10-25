import { Markup, Scenes } from "telegraf";
import ResultContext from "../types/resultContext";
import fetchCourses from "../services/fetchCourses";
import fetchPublishedResults from "../services/fetchPublishedResults";
import fetchResult from "../services/fetchResult";
import formatDob from "../utils/formatDob";
import formatResultMessage from "../utils/formatResultMessage";
import formatSummaryMessage from "../utils/formatSummaryMessage";
import calculateSgpa from "../utils/calculateSgpa";

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
      await ctx.sendMessage("Choose a course:", keyboard);
      return ctx.wizard.next();
    } catch (error) {
      return handleError(ctx, error);
    }
  },
  async (ctx) => {
    if (ctx.message) {
      return ctx.reply("Please choose a valid option");
    }
    await ctx.deleteMessage();
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
      await ctx.sendMessage("Choose a result:", keyboard);
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
    await ctx.deleteMessage();
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

function handleError(ctx: ResultContext, error: any) {
  console.error(error);
  ctx.reply("Something went wrong. Please try again later.");
  return ctx.scene.leave();
}

export default resultWizard;
