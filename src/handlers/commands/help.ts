import { CustomContext } from "@/types/customContext.type";

async function help(ctx: CustomContext) {
  const helpMessage = `
➡️ <b>Available Commands</b>

• /start - Start the bot

• /help - Show this help message
 
• /result - Fetch your exam results
 
• /cancel - Cancel ongoing lookup process
 
• /notifications - Get published KTU notifications
 
• /calendar - Get published KTU academic calendars
 
• /timetable - Get published KTU exam time tables 
 
• /subscribe - Subscribe to recieve new KTU notifications
 
• /unsubscribe - Unsubscribe from receiving new KTU notifications
 
• /changefilter - Change the filter for notifications
 
• /code - Get the source code of this bot

➡️ <b>Inline Query</b>:

Use the inline query feature to live search for notifications. 

Simply type @ktu_results_bot followed by a keyword you want to search for.

eg: <code>@ktu_results_bot exam</code>
`;

  await ctx.replyWithHTML(helpMessage, {
    link_preview_options: {
      is_disabled: true,
    },
  });
}

export default help;
