import { Context } from "telegraf";

function cancel(ctx: Context) {
  ctx.reply(
    "There are no on going operations to cancel. Use /result to start a result lookup or /notifications to start an notifications lookup.",
  );
}

export default cancel;
