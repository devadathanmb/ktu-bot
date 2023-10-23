import { Context, Markup } from "telegraf";

function start(ctx: Context) {
  const welcomeMessage = `👋 Welcome to the KTU Results Bot!`;

  const instructions = `To check your results, use the following commands:
  /result - Get your exam results
  /help - Get help`;

  const formattedMessage = `${welcomeMessage}\n\n${instructions}`;

  const keyboard = Markup.keyboard(["/result", "/help"]).resize();

  ctx.replyWithHTML(formattedMessage, keyboard);
}

export default start;
