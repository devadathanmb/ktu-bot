import { InlineKeyboard } from "grammy";
import { ICON } from "../../../utils/message-style.js";

export const INLINE_ANNOUNCEMENTS_SEARCH_BUTTON = [
  InlineKeyboard.switchInlineCurrent(
    `${ICON.announcements} Search Announcements`,
    "ann: "
  ),
];

export const INLINE_CALENDARS_SEARCH_BUTTON = [
  InlineKeyboard.switchInlineCurrent(
    `${ICON.calendars} Search Academic Calendars`,
    "cal: "
  ),
];

export const INLINE_TIMETABLES_SEARCH_BUTTON = [
  InlineKeyboard.switchInlineCurrent(
    `${ICON.timetables} Search Exam Timetables`,
    "tt: "
  ),
];

export const INLINE_SEARCH_HELP_KEYBOARD = InlineKeyboard.from([
  INLINE_ANNOUNCEMENTS_SEARCH_BUTTON,
  INLINE_CALENDARS_SEARCH_BUTTON,
  INLINE_TIMETABLES_SEARCH_BUTTON,
]);
