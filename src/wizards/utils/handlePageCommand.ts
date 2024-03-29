import { CustomContext } from "types/customContext.type";
import { message } from "telegraf/filters";

async function handlePageCommand(
  ctx: CustomContext,
  deleteMsgFn: (ctx: CustomContext, msgId: number | null) => Promise<void>,
  showItemsFn: (ctx: CustomContext) => Promise<void>
) {
  if (!ctx.has(message("text"))) {
    return await ctx.replyWithHTML(
      "Please enter a valid page number.\n\nExample: <code>/page 1</code>"
    );
  }
  const page = Number.parseInt(ctx.message.text.split(" ")[1]);
  if (isNaN(page) || page < 1) {
    return await ctx.replyWithHTML(
      "Please enter a valid page number.\n\nExample: <code>/page 1</code>"
    );
  }
  ctx.scene.session.pageNumber = page - 1;
  await deleteMsgFn(ctx, ctx.scene.session.tempMsgId);
  await showItemsFn(ctx);
}

export default handlePageCommand;
