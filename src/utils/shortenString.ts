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
