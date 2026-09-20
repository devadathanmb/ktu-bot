import { BotContext } from "../../../../types/bot.types.js";
import { CommandGroup } from "@grammyjs/commands";
import { startCommand } from "./start.js";
import { helpCommand } from "./help.js";
import { codeCommand } from "./code.js";
import { searchCommand } from "./search.js";
import { ktuAPIStatusCommand } from "./api-status.js";
import { registerCoreCommands } from "./registry.js";

/**
 * Command registry shared by the core composer and the help command.
 * Lives outside `composer.ts` so `help.ts` can read the group without
 * importing back into the composer that registers it.
 */
export const coreCommandsGroup = new CommandGroup<BotContext>();

coreCommandsGroup
  .add(startCommand)
  .add(helpCommand)
  .add(searchCommand)
  .add(codeCommand)
  .add(ktuAPIStatusCommand);

registerCoreCommands(
  coreCommandsGroup.commands.map(({ name, description }) => ({
    name,
    description,
  }))
);
