import { CustomContext } from "@/types/customContext.type";

async function deleteMessage(ctx: CustomContext, messageId: number) {
  try {
    await ctx.deleteMessage(messageId);
  } catch (error) {}
}

export default deleteMessage;
