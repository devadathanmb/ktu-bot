import { Context, SessionFlavor } from "grammy";
import { CommandsFlavor } from "@grammyjs/commands";
import { EmojiFlavor } from "@grammyjs/emoji";
import { HydrateFlavor } from "@grammyjs/hydrate";
import {
  Announcement,
  ExamTimeTable,
  AcademicCalendar,
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
}

type BotContext = HydrateFlavor<Context> &
  CommandsFlavor &
  EmojiFlavor &
  SessionFlavor<SessionData>;

export type { BotContext, SessionData };
