import { Markup, Scenes } from "telegraf";
import { CustomContext } from "../types/customContext.type";
import fetchCourses from "../services/fetchCourses";
import fetchPublishedResults from "../services/fetchPublishedResults";
import { fetchResult } from "../services/fetchResult";
import formatDob from "../utils/formatDob";
import formatResultMessage from "../utils/formatResultMessage";
import formatSummaryMessage from "../utils/formatSummaryMessage";
import calculateSgpa from "../utils/calculateSgpa";
import deleteMessage from "../utils/deleteMessage";
import handleError from "../utils/handleError";

const handleCancelCommand = async (ctx: CustomContext) => {
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
  await deleteMessage(ctx, ctx.scene.session.courseMsgId);
  await deleteMessage(ctx, ctx.scene.session.resultMsgId);
  await ctx.reply(
    "Result look up cancelled.\n\nPlease use /result to start again."
  );
  return await ctx.scene.leave();
};

const resultWizard = new Scenes.WizardScene<CustomContext>(
  "result-wizard",
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
  async (ctx) => {
    if (ctx.message) {
      return await ctx.reply(
        "Please use the buttons to choose a result.\n\nUse /cancel to cancel result lookup."
      );
    }
    await deleteMessage(ctx, ctx.scene.session.courseMsgId);
    const courseId: number = Number.parseInt(
      (ctx.callbackQuery as any)?.data?.split("_")[1]
    );
    ctx.scene.session.courseId = courseId;
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
      const keyboard = Markup.inlineKeyboard(resultButtons, { columns: 1 });
      const msg = await ctx.sendMessage("Choose a result:", keyboard);
      ctx.scene.session.resultMsgId = msg.message_id;
      return ctx.wizard.next();
    } catch (error) {
      return await handleError(ctx, error);
    }
  },
  async (ctx) => {
    if (ctx.message) {
      return await ctx.reply("Please choose a valid option");
    }
    const [examDefId, schemeId] = (ctx.callbackQuery as any)?.data?.split("_");
    await deleteMessage(ctx, ctx.scene.session.resultMsgId);
    ctx.scene.session.examDefId = examDefId;
    ctx.scene.session.schemeId = schemeId;
    await ctx.reply("Please enter your KTU Registration Number");
    return ctx.wizard.next();
  },
  async (ctx) => {
    const regisNo: string = (ctx.message as any)?.text;
    if (!regisNo) {
      return await ctx.reply("Please enter a valid registration number");
    }
    ctx.scene.session.regisNo = regisNo.toUpperCase();
    await ctx.replyWithHTML(
      "Please enter your Date of Birth\n\n<b>Format: DD/MM/YYYY</b> \n\n<b><i>Example: 01/01/2000</i></b>"
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    let dob: string = (ctx.message as any)?.text;
    if (!dob) {
      return await ctx.reply("Please enter a valid date of birth");
    }
    try {
      dob = formatDob(dob);
    } catch (error) {
      return await ctx.reply("Please enter a valid date of birth");
    }
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
