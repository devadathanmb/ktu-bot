import { Telegraf } from "telegraf";
import "dotenv/config";
import start from "./commands/start";
import help from "./commands/help";
import cancel from "./commands/cancel";
import result from "./commands/result";
import defaultHandler from "./commands/defaultHandler";
import { Scenes, session } from "telegraf";
import resultWizard from "./scenes/resultWizard";
import { CustomContext } from "./types/customContext";

const bot = new Telegraf<CustomContext>(process.env.BOT_TOKEN!);
const stage = new Scenes.Stage<CustomContext>([resultWizard]);

bot.use(session());
bot.use(stage.middleware());

bot.start((ctx) => start(ctx));
bot.command("help", (ctx) => help(ctx));
bot.command("result", (ctx) => result(ctx));
bot.command("cancel", (ctx) => cancel(ctx));
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

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
