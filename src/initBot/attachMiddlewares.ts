import bot from "@/bot";
import loggingMiddleware from "middlewares/loggingMiddleware";
import { Scenes, session } from "telegraf";
import resultWizard from "wizards/resultWizard";
import academicCalendarWizard from "wizards/calendarWizard";
import announcementWizard from "wizards/announcementWizard";
import timetableWizard from "wizards/timeTableWizard";
import { CustomContext } from "types/customContext.type";
import throttler from "@/middlewares/throttler";
import warningMiddleWare from "@/middlewares/warning";
import logger from "@/utils/logger";

// Attach all middlewares to the bot
function attachMiddlewares() {
  logger.info("[TELEGRAF] Attaching middlewares");
  // Create wizard
  const stage = new Scenes.Stage<CustomContext>([
    resultWizard,
    announcementWizard,
    academicCalendarWizard,
    timetableWizard,
  ]);

  // Register middlewares
  bot.use(loggingMiddleware);
  bot.use(warningMiddleWare);
  bot.use(throttler);
  bot.use(session());
  bot.use(stage.middleware());
}

export default attachMiddlewares;
