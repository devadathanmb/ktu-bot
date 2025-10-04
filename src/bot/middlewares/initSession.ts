import { SessionData } from "../../types/bot.types.js";

export const initSession = (): SessionData => ({
  announcementSubscriptionMessageId: null,
  selectedFilters: [],
  announcementsPage: null,
  announcementsAnnouncements: [],
  announcementsMessageId: null,
  timetablePage: null,
  timetableTimetables: [],
  timetableMessageId: null,
  calendarPage: null,
  calendarCalendars: [],
  calendarMessageId: null,
});
