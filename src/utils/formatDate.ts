/**
 * Format a Date object into a human-readable format
 *
 * Converts a Date object into a formatted string with both long format and short format.
 * Returns an empty string if the input is falsy.
 *
 * @param date - Date object to format
 * @returns Formatted date string like "January 15, 2024 (15/01/2024)", or empty string if input is falsy
 *
 * @example
 * ```typescript
 * formatDate(new Date("2024-01-15")); // Returns "January 15, 2024 (15/01/2024)"
 * formatDate(null); // Returns ""
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
