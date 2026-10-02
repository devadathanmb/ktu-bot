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
    description: "Meet the bot",
  },
  help: {
    name: "help",
    description: "See everything I can do",
  },
  search: {
    name: "search",
    description: "Search KTU from any chat",
  },
  code: {
    name: "code",
    description: "View the source code",
  },
  serverstatus: {
    name: "serverstatus",
    description: "Check if KTU services are up",
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
