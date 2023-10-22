import { Context } from "telegraf";

function defaultHandler(ctx: Context) {
  ctx.reply("Default handler");
}

export default defaultHandler;
