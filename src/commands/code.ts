import { CustomContext } from "../types/customContext.type";

function code(ctx: CustomContext) {
  const replyMsg = `
This bot is fully open source! 🌐

Check out the code in the <a href="https://github.com/devadathanmb/ktu-bot.git">GitHub repo</a>.

Feel free to contribute to the project, or report any issues you encounter.
`;
  ctx.replyWithHTML(replyMsg);
}

export default code;
