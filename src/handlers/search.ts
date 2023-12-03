import { CustomContext } from "../types/customContext.type";

async function search(ctx: CustomContext) {
  const replyMsg = `
Please use inline query to search for a KTU notification.

Type <code>@ktu_results_bot query</code> in the bot chat and then choose the notification you want.

<b>Examples:</b>

<code>@ktu_results_bot btech</code> : To search for btech related notifications

<code>@ktu_results_bot exam registration</code> : To search for exam registration related notifications

<i>Copy the above examples and paste it in the bot chat to see the results.</i>
`;
  await ctx.replyWithHTML(replyMsg);
}
export default search;
