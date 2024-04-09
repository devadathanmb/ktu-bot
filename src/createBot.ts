import attachMiddlewares from "initBot/attachMiddlewares";
import setCommands from "initBot/setCommands";
import attachCommands from "initBot/attachCommands";
import attachListeners from "initBot/attachListeners";

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

checkEnv();

// Attach all commands, middlewares and listeners to the bot
function createBot() {
  setCommands();
  attachMiddlewares();
  attachCommands();
  attachListeners();
}

export default createBot;
