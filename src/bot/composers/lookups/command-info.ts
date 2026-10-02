/**
 * Static command metadata for the lookup composers. Command construction and
 * `/help` both read these entries, so the names and descriptions cannot drift.
 * Keep this module free of initialized composers and queues.
 */
export const announcementsCommandInfo = {
  name: "announcements",
  description: "Browse KTU announcements",
} as const;

export const calendarCommandInfo = {
  name: "calendars",
  description: "Browse academic calendars",
} as const;

export const timetableCommandInfo = {
  name: "timetables",
  description: "Browse exam timetables",
} as const;

export const syllabusCommandInfo = {
  name: "syllabus",
  description: "Download syllabuses",
} as const;

/** Ordered exactly as `/help` presents the lookup commands. */
export const lookupCommandInfos = [
  announcementsCommandInfo,
  calendarCommandInfo,
  timetableCommandInfo,
  syllabusCommandInfo,
] as const;
