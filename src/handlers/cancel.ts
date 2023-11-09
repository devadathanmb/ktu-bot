import { CustomContext } from "../types/customContext.type";

async function cancel(ctx: CustomContext) {
  await ctx.reply(
    "There are no on going operations to cancel.\n\nUse /result to start a result lookup or /notifications to start an notifications lookup.",
  );
}

export default cancel;
