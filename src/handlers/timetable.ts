import { CustomContext } from "../types/customContext.type";

async function timetable(ctx: CustomContext) {
  await ctx.scene.enter("timetable-wizard");
}

export default timetable;
