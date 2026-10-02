import { FormattedString } from "@grammyjs/parse-mode";
import { InlineKeyboard } from "grammy";
import { AcademicCalendar } from "../../../../types/service.types.js";
import { documentCard, ICON } from "../../../../utils/message-style.js";
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
    ICON.calendars,
    "Academic calendars"
  );
}

export function formatCalendarDetails(
  calendar: AcademicCalendar
): FormattedString {
  return documentCard({
    title: calendar.title,
    published: calendar.formattedPublishedDate,
  });
}
