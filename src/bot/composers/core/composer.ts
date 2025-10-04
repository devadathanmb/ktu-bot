import { BotContext } from "../../../types/bot.types.js";
import { CommandGroup } from "@grammyjs/commands";
import { Composer } from "grammy";
import { startCommand } from "./commands/start.js";
import { helpCommand } from "./commands/help.js";
import { codeCommand } from "./commands/code.js";
import { searchCommand } from "./commands/search.js";
import { ktuAPIStatusCommand } from "./commands/apiStatus.js";

// Create the core commands command group
export const coreCommandsGroup = new CommandGroup<BotContext>();

// Add commands to the group
coreCommandsGroup
  .add(startCommand)
  .add(helpCommand)
  .add(searchCommand)
  .add(codeCommand)
  .add(ktuAPIStatusCommand);

// Create the core commands composer
export const core = new Composer<BotContext>();

// Hook the command group into the composer
core.use(coreCommandsGroup);

export {
  startCommand,
  helpCommand,
  searchCommand,
  codeCommand,
  ktuAPIStatusCommand,
};
