import { emoji } from "@grammyjs/emoji";

/**
 * Static command metadata for the lookup composers. Command construction and
 * `/help` both read these entries, so the names and descriptions cannot drift.
 * This module deliberately imports nothing besides the emoji helper, which
 * keeps presentation code free of the attachment-delivery queue.
 */
export const announcementsCommandInfo = {
  name: "announcements",
  description: `${emoji("loudspeaker")} Find published announcements from KTU`,
} as const;

export const calendarCommandInfo = {
  name: "calendars",
  description: `${emoji("calendar")} Find published academic calendars from KTU`,
} as const;

export const timetableCommandInfo = {
  name: "timetables",
  description: `${emoji("books")} Find published exam timetables from KTU`,
} as const;

export const syllabusCommandInfo = {
  name: "syllabus",
  description: `${emoji("scroll")} Browse and download KTU syllabi by program and branch`,
} as const;

/** Ordered exactly as `/help` presents the lookup commands. */
export const lookupCommandInfos = [
  announcementsCommandInfo,
  calendarCommandInfo,
  timetableCommandInfo,
  syllabusCommandInfo,
] as const;
