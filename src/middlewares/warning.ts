import { Middleware } from "telegraf";
import { CustomContext } from "types/customContext.type";

const warningMiddleWare: Middleware<CustomContext> = async (ctx, next) => {
  if (ctx.message && ctx.text) {
    if (ctx.text === "/oldresults") {
      await ctx.reply("Sorry, old results checking is temporarily disabled.");
      return;
    }
  }

  next();
};

export default warningMiddleWare;
