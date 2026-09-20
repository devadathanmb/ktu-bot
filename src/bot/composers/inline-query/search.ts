import type { InlineQueryResult } from "grammy/types";
import { AcademicCalendarsRepository } from "../../../db/repositories/academic-calendars-repository.js";
import { AnnouncementsRepository } from "../../../db/repositories/announcements-repository.js";
import { ExamTimetablesRepository } from "../../../db/repositories/exam-timetables-repository.js";
import logger from "../../../utils/logger.js";
import {
  renderAnnouncementResults,
  renderCalendarResults,
  renderTimetableResults,
} from "./results.js";

export type AnnouncementsSearchRepository = Pick<
  AnnouncementsRepository,
  "search" | "getAll"
>;

export type CalendarsSearchRepository = Pick<
  AcademicCalendarsRepository,
  "search" | "getAll"
>;

export type TimetablesSearchRepository = Pick<
  ExamTimetablesRepository,
  "search" | "getAll"
>;

export async function searchAnnouncements(
  searchTerm: string,
  repo: AnnouncementsSearchRepository
): Promise<InlineQueryResult[]> {
  logger.debug({ searchTerm }, "Searching announcements");

  const dbAnnouncements = searchTerm.trim()
    ? await repo.search(searchTerm, { limit: 50 })
    : await repo.getAll({ limit: 50 });

  const announcements = dbAnnouncements.map(dbAnnouncement =>
    AnnouncementsRepository.transformToApi(dbAnnouncement)
  );

  return renderAnnouncementResults(announcements);
}

export async function searchCalendars(
  searchTerm: string,
  repo: CalendarsSearchRepository
): Promise<InlineQueryResult[]> {
  const dbCalendars = searchTerm.trim()
    ? await repo.search(searchTerm, { limit: 50 })
    : await repo.getAll({ limit: 50 });

  const calendars = dbCalendars.map(dbCalendar =>
    AcademicCalendarsRepository.transformToApi(dbCalendar)
  );

  return renderCalendarResults(calendars);
}

export async function searchTimetables(
  searchTerm: string,
  repo: TimetablesSearchRepository
): Promise<InlineQueryResult[]> {
  const dbTimetables = searchTerm.trim()
    ? await repo.search(searchTerm, { limit: 50 })
    : await repo.getAll({ limit: 50 });

  const timetables = dbTimetables.map(dbTimetable =>
    ExamTimetablesRepository.transformToApi(dbTimetable)
  );

  return renderTimetableResults(timetables);
}
