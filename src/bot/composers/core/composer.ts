import { BotContext } from "../../../types/bot.types.js";
import { Composer } from "grammy";
import { coreCommandsGroup } from "./commands/group.js";

export const core = new Composer<BotContext>();

core.use(coreCommandsGroup);

export { coreCommandsGroup };
export { helpCommand } from "./commands/help.js";
