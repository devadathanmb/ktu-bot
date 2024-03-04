import attachMiddlewares from "@/bot/attachMiddlewares";
import setCommands from "@/bot/attachMiddlewares";
import attachCommands from "@/bot/attachMiddlewares";
import attachListeners from "@/bot/attachMiddlewares";

// Attach all commands, middlewares and listeners to the bot
function createBot() {
  setCommands();
  attachMiddlewares();
  attachCommands();
  attachListeners();
}

export default createBot;
