// Helper to handle errors in wizards
import deleteMessage from "utils/deleteMessage";
import { CustomContext } from "types/customContext.type";
import InvalidDataError from "errors/InvalidDataError";
import ServerError from "errors/ServerError";
import DataNotFoundError from "errors/DataNotFoundError";
import { TelegramError } from "telegraf";
import Logger from "utils/logger";

const logger = Logger.getLogger("WIZARD_ERROR_HANDLER");

async function handleError(ctx: CustomContext, error: any) {
  if (error instanceof TelegramError) {
    if (error.response.error_code === 403) {
      if (ctx.scene.current) {
        return await ctx.scene.leave();
      }
      return;
    }
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
    logger.error(`Wizard error: ${error}`);
  }
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
  return await ctx.scene.leave();
}

export default handleError;
