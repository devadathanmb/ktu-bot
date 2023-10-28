import { CustomContext } from "../types/customContext.type";

function announcement(ctx: CustomContext) {
  ctx.scene.enter("announcement-wizard");
}

export default announcement;
