import { BotContext } from "../types/bot.types.js";
import { Command } from "@grammyjs/commands";

/**
 * Formats a Grammy command object into a properly formatted bot command string.
 *
 * Takes a Grammy Command object and extracts its string name to create a
 * formatted command string with the "/" prefix for Telegram bot usage.
 *
 * @param command - Grammy Command object containing the command configuration
 * @returns Formatted command string with "/" prefix extracted from command.stringName
 *
 * @example
 * ```typescript
 * const helpCommand = new Command("help", "Show help information");
 * formatCommand(helpCommand); // Returns "/help"
 *
 * const announcementsCommand = new Command("announcements", "Get announcements");
 * formatCommand(announcementsCommand); // Returns "/announcements"
 * ```
 */
export const formatCommand = (command: Command<BotContext>): string => {
  // Just add a simple "/" prefix to the command string and send it back
  return `/${command.stringName}`;
};
