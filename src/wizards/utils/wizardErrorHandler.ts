// Helper to handle errors in wizards
import deleteMessage from "utils/deleteMessage";
import { CustomContext } from "types/customContext.type";
import InvalidDataError from "errors/InvalidDataError";
import ServerError from "errors/ServerError";
import DataNotFoundError from "errors/DataNotFoundError";

async function handleError(ctx: CustomContext, error: any) {
  if (ctx.updateType === "callback_query") {
    await ctx.answerCbQuery();
  }
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
  if (error instanceof InvalidDataError) {
    await ctx.reply(error.message);
    await ctx.reply("Please use /result to start again.");
    return ctx.scene.leave();
  } else if (error instanceof ServerError) {
    await ctx.reply(error.message);
  } else if (error instanceof DataNotFoundError) {
    await ctx.reply(error.message);
  } else {
    console.error(error);
  }
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
  return await ctx.scene.leave();
}

export default handleError;
