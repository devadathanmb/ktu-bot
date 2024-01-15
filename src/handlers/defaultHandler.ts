import { CustomContext } from "../types/customContext.type";
import deleteMessage from "../utils/deleteMessage";
/* const randomQuotes = require("random-quotes"); */

async function defaultHandler(ctx: CustomContext) {
  // I could'nt find a better way to do this
  if ("text" in ctx.message!) {
    if (
      (ctx.message.text.includes("Subject") &&
        ctx.message.text.includes("Date") &&
        ctx.message.text.includes("Message")) ||
      ctx.message.text.includes("No results found.") ||
      ctx.message.text.includes(
        "KTU servers are having issues right now. Please try again later."
      )
    ) {
      return;
    }
  }

  const stickers = [
    "CAACAgUAAxkBAAIjEmWkDMdaYjUf4T6uEmKZqP3_XVt9AALEAwACGvW5VeOu79-faKRbNAQ",
    "CAACAgUAAxUAAWWkDMfX4fHEJcG-8rQB7GW7fgrhAAKsAQACxUqCEX-1oD1MyKOlNAQ",
    "CAACAgUAAxUAAWWkDMecvxZ2zSfFYRyVR3PYDZv5AALcAAPFSoIREnQdO3H1I6c0BA",
    "CAACAgEAAxUAAWWkDMe2KRHTK70T1_bzhF05VLa9AAKFAQACdvbRRjMtRt6ySdtQNAQ",
    "CAACAgEAAxUAAWWkDMevHuSX1bv5eO2wSQffGyhbAAIKAgACVt_JRsKACrLeA-HnNAQ",
    "CAACAgEAAxkBAAIjEWWkDMdNH59blIPM4VHkEs7-T-nBAAK4AQACk6LJRl5lhi-hVIdMNAQ",
    "CAACAgEAAxkBAAIjEGWkDMf7GJvzwlPi_o_tgZFLRx3MAAJuAQACuNfRRthcVisvOTPVNAQ",
    "CAACAgEAAxkBAAIDG2WkDs1753AJ5CqxUEaKKeKXn_MfAALiAAMJxtFG486SznOuxC40BA",
  ];

  const randomSticker = stickers[Math.floor(Math.random() * stickers.length)];

  const invalidMsg =
    "That doesn't seem like a valid command.\n\nUse /help for available commands";

  const stickerMsg = await ctx.replyWithSticker(randomSticker, {
    reply_to_message_id: ctx.message!.message_id,
  });

  await ctx.reply(invalidMsg);

  setTimeout(() => {
    deleteMessage(ctx, stickerMsg.message_id);
  }, 5000);
}

export default defaultHandler;
