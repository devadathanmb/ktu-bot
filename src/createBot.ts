import attachMiddlewares from "bot/attachMiddlewares";
import setCommands from "bot/setCommands";
import attachCommands from "bot/attachCommands";
import attachListeners from "bot/attachListeners";

// Attach all commands, middlewares and listeners to the bot
function createBot() {
  setCommands();
  attachMiddlewares();
  attachCommands();
  attachListeners();
}

export default createBot;
