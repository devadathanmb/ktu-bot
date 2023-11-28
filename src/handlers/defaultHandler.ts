import { CustomContext } from "../types/customContext.type";
const randomQuotes = require("random-quotes");

async function defaultHandler(ctx: CustomContext) {
  // I could'nt find a better way to do this
  if ("text" in ctx.message!) {
    if (
      (ctx.message.text.includes("Subject") &&
        ctx.message.text.includes("Date") &&
        ctx.message.text.includes("Message")) ||
      ctx.message.text.includes("No results found.") ||
      ctx.message.text.includes(
        "KTU servers are having issues right now. Please try again later.",
      )
    ) {
      return;
    }
  }
  const quote = randomQuotes.default();
  const message = `<i>${quote.body}</i>\n
  - <i>${quote.author}</i>`;
  const invalidMsg =
    "That doesn't seem like a valid command.\n\nUse /help for available commands";

  await ctx
    .replyWithHTML(message, {
      reply_to_message_id: ctx.message!.message_id,
    })
    .then(({ message_id }) => {
      setTimeout(() => ctx.deleteMessage(message_id), 5000);
    })
    .then(() => {
      ctx.reply(invalidMsg);
    });
}

export default defaultHandler;
