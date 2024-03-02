import deleteMessage from "./deleteMessage";
import { CustomContext } from "@/types/customContext.type";
import InvalidDataError from "@/errors/InvalidDataError";
import ServerError from "@/errors/ServerError";
import DataNotFoundError from "@/errors/DataNotFoundError";

async function handleError(ctx: CustomContext, error: any) {
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
  if (error instanceof InvalidDataError) {
    await ctx.reply(
      "Invalid roll number or dob.\n\nAre you sure that the roll number and date of birth are correct?"
    );
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
  return ctx.scene.leave();
}

export default handleError;
