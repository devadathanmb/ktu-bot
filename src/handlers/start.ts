import { CustomContext } from "@/types/customContext.type";

async function start(ctx: CustomContext) {
  // write the name
  const name = ctx.from?.first_name;
  const greeting = `Hello ${name ? name + "!" : "there!"}`;
  const replyMsg = `
${greeting} 👋

<b>Welcome to KTU Bot!</b>

I can help you get your exam results, latest KTU notifications and more!

Please use /help to see all available commands and how to use the bot.

Thanks for using this bot!
 `;

  await ctx.replyWithHTML(replyMsg);
}

export default start;
