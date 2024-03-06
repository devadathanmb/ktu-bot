import { CustomContext } from "@/types/customContext.type";
import { callbackQuery } from "telegraf/filters";
import help from "@handlers/commands/help";
import { uptime, version } from "node:process";
import { startMsg } from "@handlers/start";

function format(seconds: number) {
  function pad(s: number) {
    return (s < 10 ? "0" : "") + s;
  }
  const hours = Math.floor(seconds / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  return pad(hours) + ":" + pad(minutes) + ":" + pad(secs);
}

async function startCallbackHandler(ctx: CustomContext) {
  if (ctx.has(callbackQuery("data"))) {
    const action = ctx.callbackQuery.data.split("_")[2];
    switch (action) {
      case "help":
        await ctx.answerCbQuery();
        return await help(ctx);

      case "about":
        await ctx.answerCbQuery();
        try {
          const botUptime = format(uptime());
          const caption = `
<b>
○ Name : KTU Bot

○ Username : <code>@${ctx.me}</code>

○ Uptime : ${botUptime}

○ Language : <a href="https://www.typescriptlang.org/">TypeScript</a>

○ Runtime : <a href="https://nodejs.org/en">NodeJS ${version}</a>

○ Framework : <a href="https://telegraf.js.org">TelegrafJS v4</a>

○ Source code : <a href="https://github.com/devadathanmb/ktu-bot.git">GitHub repo</a>
</b>
`;
          await ctx.editMessageCaption(caption, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔙 Back",
                    callback_data: "start_callback_back",
                  },
                ],
              ],
            },
          });
        } catch (error) {
        } finally {
          return;
        }
      case "back":
        await ctx.answerCbQuery();
        const name = ctx.from?.first_name;
        const greeting = `Hello ${name ? name + "!" : "there!"}`;
        const caption = `${greeting} 👋\n` + startMsg;
        return await ctx.editMessageCaption(caption, {
          parse_mode: "HTML",
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
      default:
        return;
    }
  }
}

export default startCallbackHandler;
