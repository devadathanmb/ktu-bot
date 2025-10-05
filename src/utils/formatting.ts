import { fmt, FormattedString } from "@grammyjs/parse-mode";
import { Command } from "@grammyjs/commands";
import { BotContext } from "../types/bot.types.js";

/**
 * Formatting utilities for bot messages and text manipulation.
 *
 * This module provides helpers for:
 * - Combining FormattedString objects while preserving entities
 * - Formatting commands for display
 * - Date formatting for user-friendly output
 * - String truncation with ellipsis
 */

/**
 * Combines multiple FormattedString objects with a specified separator.
 *
 * This utility is designed to replace manual string concatenation with newlines
 * in fmt template literals, providing cleaner and more maintainable code.
 *
 * **Why use this utility?**
 * - Maintains proper entity offsets when combining formatted strings
 * - Avoids ugly manual newline concatenation in templates
 * - Provides consistent formatting across the codebase
 *
 * **How it works:**
 * Uses Grammy's `fmt` function with array syntax to properly combine FormattedString
 * objects while preserving text formatting entities (bold, italic, links, etc.).
 *
 * @param parts Array of FormattedString objects to combine
 * @param separator String to use between parts (default: '\n\n' for double newlines)
 * @returns Combined FormattedString with proper entity offsets
 *
 * @example
 * ```typescript
 * import { fmt, b, i } from "@grammyjs/parse-mode";
 * import { combineFormatted } from "@/utils/formatting";
 *
 * const title = fmt`${b}Title${b}`;
 * const content = fmt`Some ${i}italic${i} content`;
 * const footer = fmt`Footer text`;
 *
 * // Instead of:
 * const ugly = fmt`${title.text}\n\n${content.text}\n\n${footer.text}`;
 *
 * // Use this:
 * const clean = combineFormatted([title, content, footer]);
 *
 * // Custom separator:
 * const withDashes = combineFormatted([title, content], " - ");
 * ```
 */
export function combineFormatted(
  parts: FormattedString[],
  separator: string = "\n\n"
): FormattedString {
  if (parts.length === 0) return fmt``;
  if (parts.length === 1) return parts[0]!;

  // Create template strings array and values array for fmt function
  const templateStrings: string[] = [];
  const values: FormattedString[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    if (i === 0) {
      templateStrings.push("");
    } else {
      templateStrings.push(separator);
    }
    values.push(part);
  }

  // Add final empty string to complete the template
  templateStrings.push("");

  // Create TemplateStringsArray-compatible object
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
  const templatesArray = templateStrings as any;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  templatesArray.raw = templateStrings;

  // Use fmt function with array syntax to properly combine FormattedString objects
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return fmt(templatesArray, ...values);
}

/**
 * Shorthand for combining FormattedString objects with single newlines.
 *
 * Equivalent to calling `combineFormatted(parts, "\n")`.
 *
 * @param parts Array of FormattedString objects to combine
 * @returns Combined FormattedString with single newlines between parts
 *
 * @example
 * ```typescript
 * import { fmt, b } from "@grammyjs/parse-mode";
 * import { combineFormattedSingle } from "@/utils/formatting";
 *
 * const line1 = fmt`${b}First line${b}`;
 * const line2 = fmt`Second line`;
 *
 * const result = combineFormattedSingle([line1, line2]);
 * // Result: "First line\nSecond line" (with bold formatting preserved)
 * ```
 */
export function combineFormattedSingle(
  parts: FormattedString[]
): FormattedString {
  return combineFormatted(parts, "\n");
}

/**
 * Shorthand for combining FormattedString objects with double newlines (default).
 *
 * Equivalent to calling `combineFormatted(parts, "\n\n")` or just `combineFormatted(parts)`.
 * This is the most commonly used variant for creating well-spaced message sections.
 *
 * @param parts Array of FormattedString objects to combine
 * @returns Combined FormattedString with double newlines between parts
 *
 * @example
 * ```typescript
 * import { fmt, b, i } from "@grammyjs/parse-mode";
 * import { combineFormattedDouble } from "@/utils/formatting";
 *
 * const header = fmt`${b}Welcome Message${b}`;
 * const body = fmt`This is the ${i}main content${i} of the message.`;
 * const footer = fmt`${b}Note:${b} This is a footer note.`;
 *
 * const message = combineFormattedDouble([header, body, footer]);
 * // Result: Well-spaced message with proper formatting preserved
 * ```
 */
export function combineFormattedDouble(
  parts: FormattedString[]
): FormattedString {
  return combineFormatted(parts, "\n\n");
}

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

/**
 * Format a Date object into a human-readable format
 *
 * Converts a Date object into a formatted string with both long format and short format.
 * Returns "N/A" if the input is falsy.
 *
 * @param date - Date object to format
 * @returns Formatted date string like "January 15, 2024 (15/01/2024)", or "N/A" if input is falsy
 *
 * @example
 * ```typescript
 * formatDateToReadableString(new Date("2024-01-15")); // Returns "January 15, 2024 (15/01/2024)"
 * formatDateToReadableString(null); // Returns "N/A"
 * ```
 */
export function formatDateToReadableString(
  date: Date | null | undefined
): string {
  if (!date) {
    return "N/A";
  }

  let formattedDate = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(date)
    .toString();

  // Format the short date as DD/MM/YYYY
  const shortDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

  formattedDate = formattedDate.concat(` (${shortDate})`);

  return formattedDate;
}

/**
 * Shorten a string to a maximum length with ellipsis
 *
 * Truncates a string to the specified maximum length and appends "..." if truncation occurs.
 * If the string is already within the limit, it returns the original string unchanged.
 *
 * @param str - String to potentially shorten
 * @param maxLength - Maximum allowed length (default: 300)
 * @returns Shortened string with "..." appended if truncated, or original string if within limit
 *
 * @example
 * ```typescript
 * shortenString("This is a very long string", 10); // Returns "This is..."
 * shortenString("Short", 10); // Returns "Short"
 * shortenString("Long text"); // Uses default maxLength of 300
 * ```
 */
export function shortenString(str: string, maxLength: number = 300): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}
