import { CustomContext } from "types/customContext.type";
import deleteMessage from "@/utils/deleteMessage";

async function handleCancelCommand(ctx: CustomContext, replyMsg: string) {
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
  await deleteMessage(ctx, ctx.scene.session.tempMsgId);
  await ctx.reply(replyMsg);
  return await ctx.scene.leave();
}

export default handleCancelCommand;
