import { BotContext } from "../../../../types/bot.types.js";
import { CommandGroup } from "@grammyjs/commands";
import { startCommand } from "./start.js";
import { helpCommand } from "./help.js";
import { codeCommand } from "./code.js";
import { searchCommand } from "./search.js";
import { ktuAPIStatusCommand } from "./api-status.js";

/**
 * Command group for the core commands. Kept outside `composer.ts` so it can
 * be imported and mounted without pulling in the composer itself.
 */
export const coreCommandsGroup = new CommandGroup<BotContext>();

coreCommandsGroup
  .add(startCommand)
  .add(helpCommand)
  .add(searchCommand)
  .add(codeCommand)
  .add(ktuAPIStatusCommand);
