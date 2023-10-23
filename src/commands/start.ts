import { Context } from "telegraf";

function start(ctx: Context) {
  const welcomeMessage = `👋 Welcome to the KTU Results Bot!`;

  const instructions = `Available commands:\n/result - Get your exam results\n/help - Get help`;

  const formattedMessage = `${welcomeMessage}\n\n${instructions}`;

  ctx.replyWithHTML(formattedMessage);
}

export default start;
