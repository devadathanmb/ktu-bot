import { Markup, Scenes } from "telegraf";
import ResultContext from "../types/resultContext";
import fetchCourses from "../services/fetchCourses";
import fetchPublishedResults from "../services/fetchPublishedResults";

const resultWizard = new Scenes.WizardScene<ResultContext>(
  "result-wizard",
  async (ctx: ResultContext) => {
    try {
      const courses = await fetchCourses();
      const courseButtons = courses.map(({ id, name }) => ({
        text: name,
        callback_data: `course_${id}`,
      }));
      const keyboard = Markup.inlineKeyboard(courseButtons, { columns: 2 });
      ctx.sendMessage("Choose a course:", keyboard);
      ctx.deleteMessage();
      return ctx.wizard.next();
    } catch (error) {
      await ctx.reply("Something went wrong. Please try again later.");
      return await ctx.scene.leave();
    }
  },
  async (ctx) => {
    const courseId: number = Number.parseInt(
      (ctx.callbackQuery as any)?.data?.split("_")[1],
    );
    ctx.session.courseId = courseId;
    try {
      const publishedResults = await fetchPublishedResults(courseId);
      console.log(publishedResults);
      const resultButtons = publishedResults.map(
        ({ resultName, examDefId, schemeId }) => ({
          text: resultName,
          callback_data: `${examDefId}_${schemeId}`,
        }),
      );
      const keyboard = Markup.inlineKeyboard(resultButtons, { columns: 1 });
      ctx.sendMessage("Choose a result:", keyboard);
      ctx.deleteMessage();
      return ctx.wizard.next();
    } catch (error) {
      console.error(error);
      ctx.reply("Something went wrong. Please try again later.");
      return await ctx.scene.leave();
    }
  },
  async (ctx) => {
    const [examDefId, schemeId] = (ctx.callbackQuery as any)?.data?.split("_");
    console.log(examDefId, schemeId);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const ktuid: string = (ctx.message as any)?.text || "";
    ctx.session.ktuid = ktuid;
    await ctx.reply("Enter your fucking dob");
    return ctx.wizard.next();
  },
  async (ctx) => {
    const dob: string = (ctx.message as any)?.text || "";
    ctx.session.dob = dob;
    return ctx.wizard.next();
  },
  async (ctx) => {
    await ctx.reply("Done");
    await ctx.reply(ctx.session.course);
    return await ctx.scene.leave();
  },
);

export default resultWizard;
