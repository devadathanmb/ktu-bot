import { Context } from "telegraf";

function help(ctx: Context) {
  ctx.reply("Help command");
}

export default help;
