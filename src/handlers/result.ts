import { CustomContext } from "@/types/customContext.type";

async function result(ctx: CustomContext) {
  await ctx.scene.enter("result-wizard");
}

export default result;
