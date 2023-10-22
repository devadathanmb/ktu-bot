import { Context } from "telegraf";

function result(ctx: Context) {
  ctx.reply("Result command");
}

export default result;
