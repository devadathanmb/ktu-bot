import { CustomContext } from "@/types/customContext.type";

async function calendar(ctx: CustomContext) {
  await ctx.scene.enter("academic-calendar-wizard");
}

export default calendar;
