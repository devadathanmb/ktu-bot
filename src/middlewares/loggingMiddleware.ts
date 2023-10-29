import { Middleware } from "telegraf";
import { CustomContext } from "../types/customContext.type";

// Only to be used for testing purposes, not in production
const loggingMiddleware: Middleware<CustomContext> = async (ctx, next) => {
  console.log(`Message from username ${ctx.from?.username}:`);
  console.log(
    `Message from name ${ctx.from?.first_name} ${ctx.from?.last_name}:`,
  );
  console.log(ctx.message);
  return next();
};

export default loggingMiddleware;
