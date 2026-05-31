enum UnderGraduateCourse {
  BTECH = "BTECH",
  BCA = "BCA",
  BDES = "BDES",
  BARCH = "BARCH",
  BVOC = "BVOC",
  HMCT = "HMCT",
  BBA = "BBA",
  BMS = "BMS",
}

enum PostGraduateCourse {
  MTECH = "MTECH",
  MCA = "MCA",
  MBA = "MBA",
  MARCH = "MARCH",
  MPLAN = "MPLAN",
  MHM = "MHM",
}

enum OtherCourse {
  PHD = "PHD",
}

const Course = {
  ...UnderGraduateCourse,
  ...PostGraduateCourse,
  ...OtherCourse,
} as const;
type Course = (typeof Course)[keyof typeof Course];

const UNDERGRADUATE_COURSES = new Set(
  Object.values(UnderGraduateCourse) as Course[]
);
const POSTGRADUATE_COURSES = new Set(
  Object.values(PostGraduateCourse) as Course[]
);
const COURSES = new Set(Object.values(Course) as Course[]);

enum AnnouncementSpecificFilter {
  ALL = "ALL",
  RELEVANT = "RELEVANT",
}

const AnnouncementFilter = {
  ...Course,
  ...AnnouncementSpecificFilter,
} as const;
type AnnouncementFilter =
  (typeof AnnouncementFilter)[keyof typeof AnnouncementFilter];

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

  "(\\bug\\b)|(\\bundergraduate\\b)": UNDERGRADUATE_COURSES,
  "(\\bpg\\b)|(\\bpostgraduate\\b)": POSTGRADUATE_COURSES,
};

export {
  AnnouncementFilter,
  ANNOUNCEMENT_FILTER_MAP,
  REGEX_COURSE_FILTER_TO_COURSE_MAP,
  UNDERGRADUATE_COURSES,
  POSTGRADUATE_COURSES,
  COURSES,
  type Course,
};
