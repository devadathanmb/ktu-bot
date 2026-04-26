import { Context, SessionFlavor } from "grammy";
import { CommandsFlavor } from "@grammyjs/commands";
import { EmojiFlavor } from "@grammyjs/emoji";
import { HydrateFlavor } from "@grammyjs/hydrate";
import {
  Announcement,
  ExamTimeTable,
  AcademicCalendar,
  Program,
  Scheme,
  Branch,
  SyllabusEntry,
} from "./service.types.js";

interface SessionData {
  announcementSubscriptionMessageId: number | null;
  selectedFilters: string[];
  // Announcements lookup session data
  announcementsPage: number | null;
  announcementsAnnouncements: Announcement[];
  announcementsMessageId: number | null;
  // Timetable lookup session data
  timetablePage: number | null;
  timetableTimetables: ExamTimeTable[];
  timetableMessageId: number | null;
  // Calendar lookup session data
  calendarPage: number | null;
  calendarCalendars: AcademicCalendar[];
  calendarMessageId: number | null;
  // Syllabus lookup session data
  syllabusProgramPage: number | null;
  syllabusSchemePage: number | null;
  syllabusBranchPage: number | null;
  syllabusSyllabusPage: number | null;
  syllabusPrograms: Program[];
  syllabusSchemes: Scheme[];
  syllabusBranches: Branch[];
  syllabusEntries: SyllabusEntry[];
  syllabusSelectedProgramId: number | null;
  syllabusSelectedSchemeId: number | null;
  syllabusMessageId: number | null;
}

type BotContext = HydrateFlavor<Context> &
  CommandsFlavor &
  EmojiFlavor &
  SessionFlavor<SessionData>;

export type { BotContext, SessionData };
