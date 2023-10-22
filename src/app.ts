import { Telegraf } from "telegraf";
import "dotenv/config";
import start from "./commands/start";
import help from "./commands/help";
import result from "./commands/result";
import defaultHandler from "./commands/defaultHandler";

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.start((ctx) => start(ctx));
bot.command("help", (ctx) => help(ctx));
bot.command("result", (ctx) => result(ctx));
bot.on("message", (ctx) => defaultHandler(ctx));

const launchBot = async () => {
  bot.launch();
  if (bot)
    bot.telegram
      .getMe()
      .then((res) =>
        console.log(`Bot started on https://t.me/${res.username}`),
      );
};

launchBot();
