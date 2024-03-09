import { CustomContext } from "types/customContext.type";

async function search(ctx: CustomContext) {
  const replyMsg = `
Please use inline query to search for a KTU notification.

Type <code>@ktu_results_bot query</code> in the bot chat and then choose the notification you want from the search results.

<b>Examples:</b>

• <code>@ktu_results_bot btech</code> : To search for <b>BTech</b> related notifications

• <code>@ktu_results_bot exam registration</code> : To search for <b>exam registration</b> related notifications
`;
  await ctx.replyWithHTML(replyMsg, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🔍 Try now",
            switch_inline_query_current_chat: "exam registration",
          },
        ],
      ],
    },
  });
}
export default search;
