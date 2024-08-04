import { Middleware } from "telegraf";
import { CustomContext } from "types/customContext.type";
import Logger from "@/utils/logger";

const logger = Logger.getLogger("TELEGRAF");

// Logging middleware
// For testing purposes
const loggingMiddleware: Middleware<CustomContext> = async (ctx, next) => {
  logger.info(`Update received : ${JSON.stringify(ctx.update)}`);
  return next();
};
export default loggingMiddleware;
