/**
 * Course enum - internal use only
 */
enum Course {
  BTECH = "BTECH",
  MTECH = "MTECH",
  BCA = "BCA",
  MCA = "MCA",
  PHD = "PHD",
  BDES = "BDES",
  BBA = "BBA",
  MBA = "MBA",
  BARCH = "BARCH",
  MARCH = "MARCH",
  BVOC = "BVOC",
  MPLAN = "MPLAN",
  HMCT = "HMCT",
  MHM = "MHM",
  BMS = "BMS",
}

/**
 * Additional announcement filters - internal use only
 */
enum AnnouncementSpecificFilter {
  ALL = "ALL",
  RELEVANT = "RELEVANT",
}

/**
 * Combined announcement filter enum - contains both courses and announcement filters
 */
const AnnouncementFilter = {
  ...Course,
  ...AnnouncementSpecificFilter,
} as const;
type AnnouncementFilter =
  (typeof AnnouncementFilter)[keyof typeof AnnouncementFilter];

/**
 * Announcement filter display names mapping
 */
const ANNOUNCEMENT_FILTER_MAP = {
  [Course.BTECH]: "B.Tech",
  [Course.MTECH]: "M.Tech",
  [Course.BCA]: "BCA",
  [Course.BBA]: "BBA",
  [Course.MCA]: "MCA",
  [Course.PHD]: "PhD",
  [Course.BDES]: "B.Des",
  [Course.MBA]: "MBA",
  [Course.BARCH]: "B.Arch",
  [Course.MARCH]: "M.Arch",
  [Course.BVOC]: "B.Voc",
  [Course.MPLAN]: "M.Plan",
  [Course.HMCT]: "Hotel Management",
  [Course.MHM]: "MHM",
  [Course.BMS]: "BMS",
  [AnnouncementSpecificFilter.ALL]: "All Announcements",
  [AnnouncementSpecificFilter.RELEVANT]: "Relevant Announcements",
} as const;

/**
 * Regex patterns mapped to course keys
 * Uses Course enum for single source of truth
 */
const REGEX_COURSE_FILTER_TO_COURSE_MAP: Record<string, Set<Course>> = {
  "\\bb\\.? ?tech": new Set([Course.BTECH]),
  "\\bm\\.? ?tech": new Set([Course.MTECH]),
  "\\bmca\\b": new Set([Course.MCA]),
  "\\bbca\\b": new Set([Course.BCA]),
  "\\bbba\\b": new Set([Course.BBA]),
  "\\bms\\b": new Set([Course.BMS]),
  "\\bp.? ?hd\\b": new Set([Course.PHD]),
  "\\bb\\.? ?des": new Set([Course.BDES]),
  "\\bmba\\b": new Set([Course.MBA]),
  "\\bb\\. ?arch": new Set([Course.BARCH]),
  "\\bm\\.? ?arch": new Set([Course.MARCH]),
  "\\bb\\.? ?voc": new Set([Course.BVOC]),
  "\\bm\\.? ?plan": new Set([Course.MPLAN]),
  "hotel management": new Set([Course.HMCT]),
  "\\bbhmct": new Set([Course.HMCT]),
  "\\bmhm\\b": new Set([Course.MHM]),
  "(\\bug\\b)|(\\bundergraduate\\b)": new Set([
    Course.BTECH,
    Course.BDES,
    Course.BARCH,
    Course.BVOC,
    Course.HMCT,
    Course.BCA,
    Course.BBA,
    Course.BMS,
  ]),
  "(\\bpg\\b)|(\\bpostgraduate\\b)": new Set([
    Course.MTECH,
    Course.MCA,
    Course.MBA,
    Course.MARCH,
    Course.MPLAN,
    Course.MHM,
  ]),
};

export {
  AnnouncementFilter,
  ANNOUNCEMENT_FILTER_MAP,
  REGEX_COURSE_FILTER_TO_COURSE_MAP,
};
