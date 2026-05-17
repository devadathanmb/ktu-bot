import { InlineKeyboard } from "grammy";
import { emoji } from "@grammyjs/emoji";

export const INLINE_ANNOUNCEMENTS_SEARCH_BUTTON = [
  InlineKeyboard.switchInlineCurrent(
    `${emoji("loudspeaker")} Search Announcements`,
    "ann: "
  ),
];

export const INLINE_CALENDARS_SEARCH_BUTTON = [
  InlineKeyboard.switchInlineCurrent(
    `${emoji("calendar")} Search Academic Calendars`,
    "cal: "
  ),
];

export const INLINE_TIMETABLES_SEARCH_BUTTON = [
  InlineKeyboard.switchInlineCurrent(
    `${emoji("clipboard")} Search Exam Timetables`,
    "tt: "
  ),
];

export const INLINE_SEARCH_HELP_KEYBOARD = InlineKeyboard.from([
  INLINE_ANNOUNCEMENTS_SEARCH_BUTTON,
  INLINE_CALENDARS_SEARCH_BUTTON,
  INLINE_TIMETABLES_SEARCH_BUTTON,
]);
