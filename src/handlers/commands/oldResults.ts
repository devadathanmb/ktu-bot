import { CustomContext } from "types/customContext.type";

async function oldResults(ctx: CustomContext) {
  const chatType = ctx.chat?.type;
  if (chatType !== "private") {
    await ctx.reply("Result lookup is only available in private chat", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Start Private Chat 🚀",
              url: `https://t.me/${ctx.botInfo?.username}?start`,
            },
          ],
        ],
      },
    });
    return;
  }
  await ctx.replyWithHTML(
    "<b>NOTE:</b> This is a beta feature and bugs maybe expected"
  );
  await ctx.scene.enter("old-results-wizard");
}

export default oldResults;
