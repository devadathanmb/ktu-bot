import { emoji } from "@grammyjs/emoji";

export const LOOKUP_CONFIG = {
  /** Number of items to fetch per page */
  PAGE_SIZE: 10,

  /** Number of item buttons to display per row in keyboard */
  ITEMS_PER_ROW: 5,

  /** Initial page number for pagination */
  INITIAL_PAGE: 0,
} as const;

export const CONTEXT_EMOJI_MAP: Record<string, string> = {
  "calendar": emoji("calendar"),
  "timetable": emoji("books"),
  "announcement": emoji("paperclip"),
  "inline query result": emoji("paperclip"),
  "syllabus": emoji("scroll"),
} as const;

export function getContextEmoji(context: string): string {
  return CONTEXT_EMOJI_MAP[context] || emoji("paperclip");
}
