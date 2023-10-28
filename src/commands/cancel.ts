import { CustomContext } from "../types/customContext.type";

function cancel(ctx: CustomContext) {
  ctx.reply(
    "There are no on going operations to cancel. Use /result to start a result lookup or /notifications to start an notifications lookup.",
  );
}

export default cancel;
