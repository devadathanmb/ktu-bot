import { FormattedString } from "@grammyjs/parse-mode";
import { InlineKeyboard } from "grammy";
import { ExamTimeTable } from "../../../../types/service.types.js";
import { documentCard, ICON } from "../../../../utils/message-style.js";
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
    ICON.timetables,
    "Exam timetables"
  );
}

export function formatTimetableDetails(
  timetable: ExamTimeTable
): FormattedString {
  return documentCard({
    title: timetable.title,
    published: timetable.formattedPublishedDate,
  });
}
