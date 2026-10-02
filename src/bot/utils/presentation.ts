import { emoji } from "@grammyjs/emoji";
import { InlineKeyboard } from "grammy";
import { ICON } from "../../utils/message-style.js";

// Neutral presentation helpers shared by interactive lookup composers and
// background workers. Keep this module free of composers, sessions, commands,
// repositories, and middleware so worker bots never load interactive code.
export const CONTEXT_EMOJI_MAP: Record<string, string> = {
  "calendar": ICON.calendars,
  "timetable": ICON.timetables,
  "announcement": ICON.announcements,
  "inline query result": ICON.file,
  "syllabus": ICON.syllabus,
} as const;

export function getContextEmoji(context: string): string {
  return CONTEXT_EMOJI_MAP[context] || ICON.file;
}

export function createViewAnotherKeyboard(
  callbackPrefix: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      `${emoji("check_mark_button")} Yes, show me`,
      `${callbackPrefix}_view_another_true`
    )
    .text(
      `${emoji("cross_mark")} No, thanks`,
      `${callbackPrefix}_view_another_false`
    );
}
