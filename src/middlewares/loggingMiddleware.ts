import { Middleware } from "telegraf";
import { CustomContext } from "types/customContext.type";
import Logger from "@/utils/logger";

const logger = new Logger("TELEGRAF");

// Logging middleware
// For testing purposes
const loggingMiddleware: Middleware<CustomContext> = async (ctx, next) => {
  logger.info(`[TELEGRAF] Update received : ${JSON.stringify(ctx.update)}`);
  return next();
};
export default loggingMiddleware;
