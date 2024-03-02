import { CustomContext } from "@/types/customContext.type";

async function announcement(ctx: CustomContext) {
  await ctx.scene.enter("announcement-wizard");
}

export default announcement;
