import { CustomContext } from "types/customContext.type";

async function help(ctx: CustomContext) {
  const helpMessage = `
➡️ <b><u>Available Commands</u></b>

• /start - Start the bot

• /help - Show help message
 
• /result - Exam results lookup 

• /oldresults - Old exam results lookup 

• /notifications - Notifications lookup
 
• /calendar - Academic calendar lookup
 
• /timetable - Exam timetable lookup
 
• /subscribe - Subscribe to KTU notifications
 
• /unsubscribe - Unsubscribe from KTU notifications
 
• /changefilter - Change notification filter
  
• /cancel - Cancel operation
 
• /code - See bot source code 

➡️ <b><u>Inline Query</u></b>:

Use the inline query feature to live search for notifications. 

Simply type @ktu_results_bot followed by a keyword you want to search for.

Use /search for more info.
`;

  await ctx.replyWithHTML(helpMessage, {
    link_preview_options: {
      is_disabled: true,
    },
  });
}

export default help;
