import { CustomContext } from "types/customContext.type";
import deleteMessage from "utils/deleteMessage";

async function defaultHandler(ctx: CustomContext) {
  // Scenes and wizards get expired due to bot restarts or inactivity
  if (ctx.updateType == "callback_query") {
    await ctx.answerCbQuery();
    await ctx.reply(
      "Session expired..\n\nPlease start corresponding command again."
    );
    return;
  }

  // Events like adding, removing memebers from groups are considered as messages
  // For groups, only direct messages are considered
  // Bot permission "can delete messages" should be unset for this to work
  if (ctx.message!.chat.type !== "private" && !("text" in ctx.message!)) return;

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

  // Don't be too serious people
  const stickers = [
    "CAACAgUAAxkBAAIjEmWkDMdaYjUf4T6uEmKZqP3_XVt9AALEAwACGvW5VeOu79-faKRbNAQ",
    "CAACAgUAAxUAAWWkDMfX4fHEJcG-8rQB7GW7fgrhAAKsAQACxUqCEX-1oD1MyKOlNAQ",
    "CAACAgUAAxUAAWWkDMecvxZ2zSfFYRyVR3PYDZv5AALcAAPFSoIREnQdO3H1I6c0BA",
    "CAACAgEAAxUAAWWkDMe2KRHTK70T1_bzhF05VLa9AAKFAQACdvbRRjMtRt6ySdtQNAQ",
    "CAACAgEAAxUAAWWkDMevHuSX1bv5eO2wSQffGyhbAAIKAgACVt_JRsKACrLeA-HnNAQ",
    "CAACAgEAAxkBAAIjEWWkDMdNH59blIPM4VHkEs7-T-nBAAK4AQACk6LJRl5lhi-hVIdMNAQ",
    "CAACAgEAAxkBAAIjEGWkDMf7GJvzwlPi_o_tgZFLRx3MAAJuAQACuNfRRthcVisvOTPVNAQ",
    "CAACAgEAAxkBAAIDG2WkDs1753AJ5CqxUEaKKeKXn_MfAALiAAMJxtFG486SznOuxC40BA",
    "CAACAgEAAxkBAAIjb2Wku0h9ffSH5o3KrG-_G8n3ZX2_AAKaAQACF3HRRqGX8GqX54aMNAQ",
    "CAACAgEAAxkBAAIjdGWku4a5-5D8WqiTrk3flix-f6K_AALXAQAC2-fJRmz1bGhY0X9JNAQ",
    "CAACAgEAAxkBAAIjeWWku5C4aUyWv3yBYvt-pMdLItVgAALfAwACqLbIRvsns46pgYiUNAQ",
    "CAACAgEAAxkBAAIjfmWku7Jdec5Q8H4SLFFl_oq4VbaoAALmDwACWBTJRv3vDkn03B_vNAQ",
    "CAACAgEAAxkBAAIjg2Wku7vOEJEIit0R8iyE9nucMgi3AALkAQACSmLRRgXYcdEaCiaKNAQ",
    "CAACAgEAAxkBAAIjiGWku9bjzu1ZiQABSnc3NZcL1eyZHwACUgEAAq890EaH6BJJGefbNTQE",
    "CAACAgEAAxkBAAIjjWWku-5dQEvKuIdjUMSIyrXgh-C2AAKwAQAC_H3QRsdi-nhAGWSPNAQ",
    "CAACAgUAAxkBAAIjkmWkvC9iQKmt-mpQeQZjcpSf2CnbAALHAAPFSoIR_HnuH9xjO_k0BA",
    "CAACAgEAAxkBAAIkAmWo82ZR8iaexHGcZDq3sNY8UvT9AAJWAQACzMHRRl4YPy05Xs2HNAQ",
    "CAACAgUAAxUAAWWo82rpI38WV0jq6qMAARi8ukCQsQAC5QEAAuG8kQTvnIzSTjMkFjQE",
    "CAACAgUAAxkBAAIkDGWo83NnPOrKvL8aFzpayI_6I1_TAALjAQAC4byRBMnaRVi-I79aNAQ",
    "CAACAgUAAxkBAAIkG2Wo8_GT5h5BvRaBtywQWhpPkIuNAAI7BAACIlhAVVgi-y9wL25NNAQ",
  ];

  const randomSticker = stickers[Math.floor(Math.random() * stickers.length)];

  const invalidMsg =
    "That doesn't seem like a valid command.\n\nUse /help for available commands";

  const stickerMsg = await ctx.replyWithSticker(randomSticker, {
    reply_parameters: {
      message_id: ctx.message!.message_id,
    },
  });

  await ctx.reply(invalidMsg);

  setTimeout(() => {
    deleteMessage(ctx, stickerMsg.message_id);
  }, 5000);
}

export default defaultHandler;
