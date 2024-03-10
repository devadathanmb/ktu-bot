import { CustomContext } from "types/customContext.type";

async function deleteMessage(ctx: CustomContext, messageId: number | null) {
  try {
    if (!messageId) return;
    await ctx.deleteMessage(messageId);
  } catch (error) {}
}

export default deleteMessage;
