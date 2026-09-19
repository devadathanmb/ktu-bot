import { emoji } from "@grammyjs/emoji";
import { FormattedString, fmt, b } from "@grammyjs/parse-mode";
import { InlineKeyboard } from "grammy";
import { AcademicCalendar } from "../../../../types/service.types.js";
import { joinWithNewlines } from "../../../../utils/formatting.js";
import {
  generatePaginatedKeyboard,
  generatePaginatedMessageText,
  PaginatedItem,
} from "../utils.js";

function calendarsToPageItems(calendars: AcademicCalendar[]): PaginatedItem[] {
  return calendars.map(calendar => ({
    id: calendar.id,
    subject: calendar.title,
    formattedPublishedDate: calendar.formattedPublishedDate,
  }));
}

export function generateCalendarsKeyboard(
  calendars: AcademicCalendar[],
  currentPage: number
): InlineKeyboard {
  const paginatedItems: PaginatedItem[] = calendarsToPageItems(calendars);
  return generatePaginatedKeyboard(paginatedItems, currentPage, "calendar", 5);
}

export function generateCalendarsText(
  calendars: AcademicCalendar[]
): FormattedString {
  const paginatedItems: PaginatedItem[] = calendarsToPageItems(calendars);
  return generatePaginatedMessageText(
    paginatedItems,
    `${emoji("graduation_cap")} Academic Calendars`,
    "calendar"
  );
}

export function formatCalendarDetails(
  calendar: AcademicCalendar
): FormattedString {
  return joinWithNewlines(
    [
      fmt`${emoji("glowing_star")} ${b}Title:${b} ${calendar.title}`,
      fmt`${emoji("calendar")} ${b}Date:${b} ${calendar.formattedPublishedDate}`,
    ],
    2
  );
}
