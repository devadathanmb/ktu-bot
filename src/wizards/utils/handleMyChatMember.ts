import { CustomContext } from "types/customContext.type";

// Helper function to handle my chat member updates in wizards
async function handleMyChatMember(ctx: CustomContext) {
  if (ctx.scene.current) {
    return await ctx.scene.leave();
  }
  return;
}

export default handleMyChatMember;
