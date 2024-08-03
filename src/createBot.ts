import attachMiddlewares from "initBot/attachMiddlewares";
import setCommands from "initBot/setCommands";
import attachCommands from "initBot/attachCommands";
import attachListeners from "initBot/attachListeners";
import Logger from "utils/logger";

const logger = new Logger("TELEGRAF");

function checkEnv() {
  if (
    !(
      process.env.BOT_TOKEN &&
      process.env.ENV_TYPE &&
      process.env.HUGGING_FACE_TOKEN &&
      process.env.FIREBASE_SERVICE_ACCOUNT &&
      process.env.FIREBASE_STORAGE_BUCKET
    )
  ) {
    throw new Error("Missing environment variables.");
  }

  if (
    process.env.ENV_TYPE === "PRODUCTION" &&
    !process.env.WEBHOOK_PORT &&
    !process.env.WEBHOOK_DOMAIN
  ) {
    throw new Error("Missing environment variables.");
  }
}

logger.debug("Checking envs");
checkEnv();

// Attach all commands, middlewares and listeners to the bot
function createBot() {
  logger.info("Setting commands");
  setCommands();
  logger.info("Attaching middlewares");
  attachMiddlewares();
  logger.info("Attaching command handlers");
  attachCommands();
  logger.info("Attaching action listeners");
  attachListeners();
}

export default createBot;
