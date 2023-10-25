import { Context } from "telegraf";

function cancel(ctx: Context) {
  ctx.reply(
    "There are no on going result lookups to cancel. Use /result to start a new lookup.",
  );
}

export default cancel;
