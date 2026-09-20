import { emoji } from "@grammyjs/emoji";

/**
 * Static metadata for the core commands. Each command in this directory
 * builds itself from these entries and `/help` renders the same list, so the
 * displayed names and descriptions cannot drift or depend on import order.
 */
export interface CoreCommandInfo {
  readonly name: string;
  readonly description: string;
}

const CORE_COMMAND_DEFS = {
  start: {
    name: "start",
    description: `${emoji("high_voltage")} Start the bot and explore features`,
  },
  help: {
    name: "help",
    description: `${emoji("red_question_mark")} Show comprehensive help with all available commands`,
  },
  search: {
    name: "search",
    description: `${emoji("magnifying_glass_tilted_left")} Search KTU resources using inline queries`,
  },
  code: {
    name: "code",
    description: `${emoji("laptop")} View the bot source code and license information`,
  },
  serverstatus: {
    name: "serverstatus",
    description: `${emoji("globe_showing_asia_australia")} Check the KTU services status`,
  },
} as const satisfies Record<string, CoreCommandInfo>;

export type CoreCommandName = keyof typeof CORE_COMMAND_DEFS;

export function coreCommand(name: CoreCommandName): CoreCommandInfo {
  return CORE_COMMAND_DEFS[name];
}

/** Ordered exactly as `/help` presents the core commands. */
export const coreCommands: readonly CoreCommandInfo[] = [
  CORE_COMMAND_DEFS.start,
  CORE_COMMAND_DEFS.help,
  CORE_COMMAND_DEFS.search,
  CORE_COMMAND_DEFS.code,
  CORE_COMMAND_DEFS.serverstatus,
];
