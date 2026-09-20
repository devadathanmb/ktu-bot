/**
 * Read-only view of the core core commands for presentation code such as
 * `/help`. The command group registers into this list, so consumers never
 * need to import the group (which would form an import cycle).
 */
export interface CoreCommandInfo {
  name: string | RegExp;
  description: string;
}

const coreCommands: CoreCommandInfo[] = [];

export function registerCoreCommands(commands: CoreCommandInfo[]): void {
  coreCommands.push(...commands);
}

export function getCoreCommands(): readonly CoreCommandInfo[] {
  return coreCommands;
}
