import { fmt, FormattedString } from "@grammyjs/parse-mode";

export function joinWithNewlines(
  parts: FormattedString[],
  count: number = 1
): FormattedString {
  if (parts.length === 0) return fmt``;
  if (parts.length === 1) return parts[0]!;

  const separator = "\n".repeat(count);

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

  templateStrings.push("");

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
  const templatesArray = templateStrings as any;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  templatesArray.raw = templateStrings;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return fmt(templatesArray, ...values);
}

/**
 * Renders a command reference for user-facing text. Static command metadata
 * entries carry a `name`, so text-only modules can format commands without
 * importing initialized composer or Command objects.
 */
export const formatCommand = (command: { readonly name: string }): string => {
  return `/${command.name}`;
};

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
  }).format(date);

  const shortDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

  formattedDate = formattedDate.concat(` (${shortDate})`);

  return formattedDate;
}

export function shortenString(str: string, maxLength: number = 300): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}
