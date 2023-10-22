import { Telegraf } from "telegraf";
import "dotenv/config";
import start from "./commands/start";
import help from "./commands/help";
import result from "./commands/result";
import defaultHandler from "./commands/defaultHandler";
import { Scenes, session } from "telegraf";
import resultWizard from "./scenes/resultWizard";
import ResultContext from "./types/resultContext";

const bot = new Telegraf<ResultContext>(process.env.BOT_TOKEN!);
const stage = new Scenes.Stage<ResultContext>([resultWizard]);

bot.use(session());
bot.use(stage.middleware());

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
