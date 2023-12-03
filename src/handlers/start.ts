import { CustomContext } from "../types/customContext.type";

async function start(ctx: CustomContext) {
  const replyMsg = `
<b>👋 Welcome to the KTU Bot!</b>

I can help you get your exam results, latest KTU notifications and more!

<b>Available commands:</b>

/result - Get your exam results

/help - Get help

/notifications - Get published KTU notifications

/calendar - Get published KTU academic calendars

/timetable - Get published KTU exam time tables

/subscribe - Subscribe to recieve new KTU notifications

/unsubscribe - Unsubscribe from receiving new KTU notifications

/start - Get this message again

/code - Find the source code of this bot, report bugs and contribute

<b>Inline Query</b>:

Use the inline query feature to live search for notifications. 

Simply type @ktu_results_bot followed by a keyword you want to search for.

eg: <code>@ktu_results_bot exam</code>

 `;

  await ctx.replyWithHTML(replyMsg);
}

export default start;
