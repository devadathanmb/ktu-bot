import { Middleware } from "telegraf";
import { CustomContext } from "types/customContext.type";

// Logging middleware
// For testing purposes
const loggingMiddleware: Middleware<CustomContext> = async (ctx, next) => {
  const time = new Date().toString();
  console.log(
    `-- [TIME : ${time}] [UPDATE : ${ctx.updateType}] [NAME : ${
      ctx.from?.first_name ? ctx.from.first_name : ""
    } ${ctx.from?.last_name ? ctx.from.last_name : ""}] [ID : ${ctx.from?.id}]`
  );
  console.log(ctx.update);
  return next();
};
export default loggingMiddleware;
