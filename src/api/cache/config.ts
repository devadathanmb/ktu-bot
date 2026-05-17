import type { CacheConfig } from "./types.js";

export const CACHE_CONFIG: CacheConfig = {
  maxEntries: 500, // Maximum number of cached responses before LRU eviction
  defaultTTL: 5 * 60 * 1000, // 5 min
  endpointTTLs: {
    "/getprograms": 60 * 60 * 1000, // 1 hour
    "/scheme": 60 * 60 * 1000,
    "/branchAccordingToScheme": 60 * 60 * 1000,
    "/getSyllabus": 60 * 60 * 1000,
    "/announcemnts": 30 * 1000, // 30 sec
    "/timetable": 5 * 60 * 1000,
    "/academicCalendar": 5 * 60 * 1000,
  },
  excludePaths: [
    "/getAttachments", // large base64 payloads
    "/getAttachment", // large base64 payloads
    "/get?key=v3", // reCAPTCHA check — should never be cached
  ],
};
