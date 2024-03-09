import { CustomContext } from "types/customContext.type";

const startMsg = `
<b>Welcome to KTU Bot!</b>

I can help you get your exam results, latest KTU notifications and more!

Please use /help to see all available commands and how to use the bot.

Thanks for using this bot!`;

async function start(ctx: CustomContext) {
  // write the name
  const name = ctx.from?.first_name;
  const greeting = `Hello ${name ? name + "!" : "there!"}`;
  const botImgLink = "https://i.imgur.com/kiAUtfR.jpeg";
  const caption = `${greeting} 👋\n` + startMsg;

  await ctx.replyWithPhoto(botImgLink, {
    parse_mode: "HTML",
    caption: caption,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🚀 Help",
            callback_data: "start_callback_help",
          },
          {
            text: "❗ About",
            callback_data: "start_callback_about",
          },
        ],
      ],
    },
  });
}

export default start;
export { startMsg };
