import { CustomContext } from "../types/customContext.type";

function start(ctx: CustomContext) {
  const welcomeMessage = `👋 Welcome to the KTU Results Bot!`;

  const instructions = `Available commands:\n/result - Get your exam results\n/help - Get help\n/notifications - Get the latest KTU notifications\n/subscribe - Subscribe to recieve new KTU notifications\n/unsubscribe - Unsubscribe from receiving new KTU notifications`;

  const formattedMessage = `${welcomeMessage}\n\n${instructions}`;

  ctx.replyWithHTML(formattedMessage);
}

export default start;
