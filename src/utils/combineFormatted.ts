import { fmt, FormattedString } from "@grammyjs/parse-mode";

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
 * import { combineFormatted } from "@/utils/combineFormatted";
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
 * import { combineFormattedSingle } from "@/utils/combineFormatted";
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
 * import { combineFormattedDouble } from "@/utils/combineFormatted";
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
