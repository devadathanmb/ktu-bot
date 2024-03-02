import { Middleware } from "telegraf";
import { CustomContext } from "@/types/customContext.type";

// Logging middleware
// For testing purposes
const loggingMiddleware: Middleware<CustomContext> = async (ctx, next) => {
  const time = new Date().toString();
  console.log(
    `➡️ [${time}] ${ctx.updateType} from ${
      ctx.from?.first_name ? ctx.from.first_name : ""
    } ${ctx.from?.last_name ? ctx.from.last_name : ""} ID : ${ctx.from?.id}`
  );
  console.log(ctx.message);
  /* if (ctx.updateType === "message") console.log(ctx.message); */
  /* else if (ctx.updateType === "callback_query") console.log(ctx.callbackQuery); */
  return next();
};

export default loggingMiddleware;
