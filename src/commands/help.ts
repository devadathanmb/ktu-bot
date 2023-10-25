import { Context } from "telegraf";

function help(ctx: Context) {
  const helpMessage = `
<b>Available Commands:</b>

/start - Start the bot
/help - Show this help message
/result - Fetch your exam results
/cancel - Cancel the result lookup

If you encounter any issues, have feature suggestions, or want to contribute to the project, please visit the <a href="https://github.com/devadathanmb/ktu-results-bot.git">Github repo</a>.

Thanks for using this bot!
`;

  ctx.replyWithHTML(helpMessage);
}

export default help;
