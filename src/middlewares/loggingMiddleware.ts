import { Middleware } from "telegraf";
import { CustomContext } from "types/customContext.type";
import logger from "@/utils/logger";

// Logging middleware
// For testing purposes
const loggingMiddleware: Middleware<CustomContext> = async (ctx, next) => {
  logger.info(`[LOGGER] Update received : ${JSON.stringify(ctx.update)}`);
  return next();
};
export default loggingMiddleware;
