import { CustomContext } from "../types/customContext.type";

async function start(ctx: CustomContext) {
  const replyMsg = `
<b>👋 Welcome to the KTU Bot!</b>

I can help you get your exam results, latest KTU notifications and more!

<b>Available commands:</b>

/result - Get your exam results

/help - Get help

/notifications - Get the latest KTU notifications

/subscribe - Subscribe to recieve new KTU notifications

/unsubscribe - Unsubscribe from receiving new KTU notifications

/start - Get this message again

/code - Get the source code of this bot
`;

  /* const welcomeMessage = `👋 Welcome to the KTU Bot!\n\nI can help you get your exam results, latest KTU notifications and more!\n\nI'm open source! Check out my code at`; */
  /**/
  /* const instructions = `Available commands:\n/result - Get your exam results\n/help - Get help\n/notifications - Get the latest KTU notifications\n/subscribe - Subscribe to recieve new KTU notifications\n/unsubscribe - Unsubscribe from receiving new KTU notifications`; */
  /**/
  /* const formattedMessage = `${welcomeMessage}\n\n${instructions}`; */
  /**/
  await ctx.replyWithHTML(replyMsg);
}

export default start;
