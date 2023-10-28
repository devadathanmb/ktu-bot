import { CustomContext } from "../types/customContext.type";

function result(ctx: CustomContext) {
  ctx.scene.enter("result-wizard");
}

export default result;
