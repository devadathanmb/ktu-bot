import { CustomContext } from "@/types/customContext.type";

async function code(ctx: CustomContext) {
  const replyMsg = `
This bot is fully open source! 🌐

Check out the code in the <a href="https://github.com/devadathanmb/ktu-bot.git">GitHub repo</a>.

Liked the bot? Consider giving it a ⭐️ on GitHub.

Feel free to contribute to the project, or report any issues you encounter.
`;
  await ctx.replyWithHTML(replyMsg);
}

export default code;
