import { emoji } from "@grammyjs/emoji";
import { FormattedString, fmt, b } from "@grammyjs/parse-mode";
import { InlineKeyboard } from "grammy";
import { ExamTimeTable } from "../../../../types/service.types.js";
import { joinWithNewlines } from "../../../../utils/formatting.js";
import {
  generatePaginatedKeyboard,
  generatePaginatedMessageText,
  PaginatedItem,
} from "../utils.js";

function timetablesToPageItems(timetables: ExamTimeTable[]): PaginatedItem[] {
  return timetables.map(timetable => ({
    id: timetable.id,
    subject: timetable.title,
    formattedPublishedDate: timetable.formattedPublishedDate,
  }));
}

export function generateTimetablesKeyboard(
  timetables: ExamTimeTable[],
  currentPage: number
): InlineKeyboard {
  const paginatedItems = timetablesToPageItems(timetables);
  return generatePaginatedKeyboard(paginatedItems, currentPage, "timetable", 5);
}

export function generateTimetablesText(
  timetables: ExamTimeTable[]
): FormattedString {
  const paginatedItems = timetablesToPageItems(timetables);
  return generatePaginatedMessageText(
    paginatedItems,
    `${emoji("books")} Exam Timetables`,
    "timetable"
  );
}

export function formatTimetableDetails(
  timetable: ExamTimeTable
): FormattedString {
  const parts: FormattedString[] = [];

  if (timetable.title) {
    parts.push(
      joinWithNewlines([
        fmt`${b}${emoji("glowing_star")} Title:${b}`,
        fmt`${timetable.title}`,
      ])
    );
  }
  if (timetable.formattedPublishedDate) {
    parts.push(
      fmt`${b}${emoji("calendar")} Date:${b} ${timetable.formattedPublishedDate}`
    );
  }

  return joinWithNewlines(parts, 2);
}
