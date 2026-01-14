import { InlineKeyboard } from "grammy";
import { emoji } from "@grammyjs/emoji";

/**
 * Individual button rows for reusability
 * Each is an array of button objects that can be composed into keyboards
 */
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

/**
 * Combined keyboard with all search options stacked vertically
 * Built using InlineKeyboard.from() to compose individual button rows
 */
export const INLINE_SEARCH_HELP_KEYBOARD = InlineKeyboard.from([
  INLINE_ANNOUNCEMENTS_SEARCH_BUTTON,
  INLINE_CALENDARS_SEARCH_BUTTON,
  INLINE_TIMETABLES_SEARCH_BUTTON,
]);
