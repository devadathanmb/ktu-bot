import attachMiddlewares from "initBot/attachMiddlewares";
import setCommands from "initBot/setCommands";
import attachCommands from "initBot/attachCommands";
import attachListeners from "initBot/attachListeners";
import Logger from "utils/logger";

const logger = Logger.getLogger("TELEGRAF");

const commonEnvs = [
  'BOT_TOKEN',
  'ENV_TYPE',
  'HUGGING_FACE_TOKEN',
  'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_STORAGE_BUCKET'
];

const prodEnvs = [
  'WEBHOOK_PORT',
  'WEBHOOK_DOMAIN'
];

function checkEnvs() {
  for (const envKey of commonEnvs) {
    logger.debug(`Checking env : ${envKey}`);
    if (!process.env[envKey]) {
      logger.error(`Environment variable : ${envKey} not found.`);
      throw new Error(`Missing environment variable ${envKey}`);
    }
  }

  if (process.env.ENV_TYPE === "PRODUCTION") {
    for (const envKey of prodEnvs) {
      logger.debug(`Checking production env : ${envKey}`);
      if (!process.env[envKey]) {
        logger.error(`Environment variable : ${envKey} not found.`);
        throw new Error(`Missing environment variable ${envKey}`);
      }
    }
  }
}

// Attach all commands, middlewares and listeners to the bot
async function createBot() {
  logger.debug("Checking envs..");
  checkEnvs();
  logger.info("Setting commands");
  await setCommands();
  logger.info("Attaching middlewares");
  attachMiddlewares();
  logger.info("Attaching command handlers");
  attachCommands();
  logger.info("Attaching action listeners");
  attachListeners();
}

export default createBot;
