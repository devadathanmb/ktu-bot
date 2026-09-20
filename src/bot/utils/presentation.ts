import { emoji } from "@grammyjs/emoji";
import { InlineKeyboard } from "grammy";

// Neutral presentation helpers shared by interactive lookup composers and
// background workers. Keep this module free of composers, sessions, commands,
// repositories, and middleware so worker bots never load interactive code.
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

export function createViewAnotherKeyboard(
  callbackPrefix: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      `${emoji("check_mark_button")} Yes`,
      `${callbackPrefix}_view_another_true`
    )
    .text(`${emoji("cross_mark")} No`, `${callbackPrefix}_view_another_false`);
}
