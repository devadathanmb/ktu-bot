export interface AttachmentInfo {
  name: string;
  encryptId: string;
}

export enum SearchType {
  ANNOUNCEMENTS = "announcements",
  CALENDARS = "calendars",
  TIMETABLES = "timetables",
}

export const SEARCH_PREFIXES_TO_TYPE_MAP: Record<string, SearchType> = {
  "ann:": SearchType.ANNOUNCEMENTS,
  "cal:": SearchType.CALENDARS,
  "tt:": SearchType.TIMETABLES,
} as const;

export const SEARCH_TYPE_TO_RESULT_ID_PREFIX_MAP: Record<SearchType, string> = {
  [SearchType.ANNOUNCEMENTS]: "ann",
  [SearchType.CALENDARS]: "cal",
  [SearchType.TIMETABLES]: "tt",
} as const;

export const SPECIAL_RESULT_PREFIXES = {
  HELP: "help_",
  NO_RESULTS: "no_",
} as const;
