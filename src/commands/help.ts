import { Context } from "telegraf";

function help(ctx: Context) {
  const helpMessage = `
<b>Available Commands:</b>

/start - Start the bot
/help - Show this help message
/results - Fetch your exam results

Thanks for using this bot
`;

  ctx.replyWithHTML(helpMessage);
}

export default help;
