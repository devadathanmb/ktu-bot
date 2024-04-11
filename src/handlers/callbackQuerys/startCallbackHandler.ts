import { CustomContext } from "types/customContext.type";
import { callbackQuery } from "telegraf/filters";
import help from "handlers/commands/help";
import { uptime, version } from "node:process";
import { startMsg } from "handlers/start";
import { fmt } from "telegraf/format";

function format(seconds: number) {
  function pad(s: number) {
    return (s < 10 ? "0" : "") + s;
  }
  const hours = Math.floor(seconds / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  return pad(hours) + ":" + pad(minutes) + ":" + pad(secs);
}

function getCommitLink(commitHash: string) {
  const link = `<a href="https://github.com/devadathanmb/ktu-bot/commit/${commitHash}">${commitHash.slice(0, 7)}</a>`;
  return link;
}

async function startCallbackHandler(ctx: CustomContext) {
  await ctx.answerCbQuery();
  if (ctx.has(callbackQuery("data"))) {
    const action = ctx.callbackQuery.data.split("_")[2];
    switch (action) {
      case "help":
        return await help(ctx);

      case "about":
        try {
          const botUptime = format(uptime());
          const caption = `
○ Name : ${ctx.botInfo.first_name}

○ Username : <code>@${ctx.botInfo.username}</code>

○ Bot ID : <code>${ctx.botInfo.id}</code>

○ Uptime : ${botUptime} hrs

○ Language : <a href="https://www.typescriptlang.org/">TypeScript</a>

○ Runtime : <a href="https://nodejs.org/en">NodeJS ${version}</a>

○ Deployed commit  : ${process.env.LATEST_COMMIT ? getCommitLink(process.env.LATEST_COMMIT) : "N/A"}

○ Framework : <a href="https://telegraf.js.org">TelegrafJS v4</a>

○ Source code : <a href="https://github.com/devadathanmb/ktu-bot.git">GitHub Repo</a>
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
        const name = ctx.from?.first_name;
        const greeting = `Hello ${name ? name + "!" : "there!"}`;
        const caption = fmt`${greeting} 👋\n ${startMsg}`;

        return await ctx.editMessageCaption(caption, {
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
