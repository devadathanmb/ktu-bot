import { CustomContext } from "@/types/customContext.type";

async function result(ctx: CustomContext) {
  const chatType = ctx.chat?.type;
  if (chatType !== "private") {
    await ctx.reply("Result lookup is only available in private chat");
    return;
  }
  await ctx.scene.enter("result-wizard");
}

export default result;
