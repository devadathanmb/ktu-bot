import attachMiddlewares from "initBot/attachMiddlewares";
import setCommands from "initBot/setCommands";
import attachCommands from "initBot/attachCommands";
import attachListeners from "initBot/attachListeners";

// Attach all commands, middlewares and listeners to the bot
function createBot() {
  setCommands();
  attachMiddlewares();
  attachCommands();
  attachListeners();
}

export default createBot;
