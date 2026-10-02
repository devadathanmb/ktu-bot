import { emoji } from "@grammyjs/emoji";
import { b, blockquote, fmt, FormattedString } from "@grammyjs/parse-mode";
import { formatCommand, joinWithNewlines } from "./formatting.js";

// Shared look for every user-facing message. Keep this module free of
// composers, sessions, and middleware so workers and error classes can use it.

/** One emoji per concept, reused on every surface that mentions it. */
export const ICON = {
  announcements: emoji("loudspeaker"),
  calendars: emoji("spiral_calendar"),
  timetables: emoji("clipboard"),
  syllabus: emoji("books"),
  alertsOn: emoji("bell"),
  alertsOff: emoji("bell_with_slash"),
  search: emoji("magnifying_glass_tilted_left"),
  loading: emoji("hourglass_not_done"),
  success: emoji("check_mark_button"),
  problem: emoji("warning"),
  tip: emoji("light_bulb"),
  info: emoji("information"),
  file: emoji("page_facing_up"),
  link: emoji("link"),
  title: emoji("open_book"),
  message: emoji("memo"),
  published: emoji("calendar"),
  pointer: emoji("backhand_index_pointing_down"),
  greeting: emoji("waving_hand"),
} as const;

/** Blocks are separated by one blank line. */
export function blocks(parts: FormattedString[]): FormattedString {
  return joinWithNewlines(parts, 2);
}

/** Lines that belong together are separated by a single newline. */
export function lines(parts: FormattedString[]): FormattedString {
  return joinWithNewlines(parts, 1);
}

export function heading(icon: string, text: string): FormattedString {
  return fmt`${icon} ${b}${text}${b}`;
}

/** Bold label on one line, value directly under it. */
export function field(
  icon: string,
  label: string,
  value: string
): FormattedString {
  return lines([heading(icon, label), fmt`${value}`]);
}

export function bullets(items: readonly string[]): FormattedString {
  return lines(items.map(item => fmt`• ${item}`));
}

/** A quoted aside. Plain text only: entities inside quotes are limited. */
export function tip(text: string): FormattedString {
  return fmt`${blockquote}${ICON.tip} ${text}${blockquote}`;
}

export function loading(what: string): FormattedString {
  return fmt`${ICON.loading} Loading ${what}…`;
}

/** Status shown while a queued file is being fetched. */
export function downloading(what: string, plural = false): FormattedString {
  return blocks([
    fmt`${ICON.loading} Getting your ${what}…`,
    plural
      ? fmt`I’ll send them here as soon as they’re ready.`
      : fmt`I’ll send it here as soon as it’s ready.`,
  ]);
}

/** What went wrong, then what to do about it. */
export function problem(what: string, next?: string): FormattedString {
  const head = fmt`${ICON.problem} ${what}`;
  return next ? blocks([head, fmt`${next}`]) : head;
}

export function success(what: string, next?: string): FormattedString {
  const head = fmt`${ICON.success} ${what}`;
  return next ? blocks([head, fmt`${next}`]) : head;
}

/** A callback whose data no longer matches the session. */
export function invalidSelection(command: {
  readonly name: string;
}): FormattedString {
  return problem(
    "That option isn’t available anymore.",
    `Use ${formatCommand(command)} to start again.`
  );
}

/** Shown when the user ends a lookup with "No". */
export function lookupEnded(
  command: { readonly name: string },
  what: string
): string {
  return `Use ${formatCommand(command)} anytime to browse ${what} again.`;
}

export function viewAnotherPrompt(noun: string): string {
  return `${emoji("eyes")} Want to see another ${noun}?`;
}

/**
 * The one layout for an announcement, calendar, or timetable. Lookups, inline
 * results, and the notification worker all render it so they cannot drift.
 */
export function documentCard(doc: {
  title?: string | null | undefined;
  message?: string | null | undefined;
  published?: string | null | undefined;
}): FormattedString {
  const parts: FormattedString[] = [];
  if (doc.title) parts.push(field(ICON.title, "Title", doc.title));
  if (doc.message) parts.push(field(ICON.message, "Message", doc.message));
  if (doc.published) {
    parts.push(field(ICON.published, "Published", doc.published));
  }
  return blocks(parts);
}
