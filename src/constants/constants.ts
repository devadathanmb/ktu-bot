const COURSES_URL = "https://api.ktu.edu.in/ktu-web-service/anon/masterData";
const PUBLISHED_RESULTS_URL =
  "https://api.ktu.edu.in/ktu-web-service/anon/result";
const RESULT_URL =
  "https://api.ktu.edu.in/ktu-web-service/anon/individualresult";
const ANOUNCEMENTS_URL =
  "https://api.ktu.edu.in/ktu-web-portal-api/anon/announcemnts";
const ATTACHMENT_URL =
  "https://api.ktu.edu.in/ktu-web-portal-api/anon/getAttachment";
const ACADEMIC_CALENDAR_URL =
  "https://api.ktu.edu.in/ktu-web-portal-api/anon/academicCalendar";
const TIMETABLE_URL =
  "https://api.ktu.edu.in/ktu-web-portal-api/anon/timetable";

const FILTERS_REGEX: Record<string, Array<string>> = {
  "\\bb\\.? ?tech": ["btech"],
  "\\bm\\.? ?tech": ["mtech"],
  "\\bmca\\b": ["mca"],
  "\\bphd\\b": ["phd"],
  "\\bb\\.? ?des": ["bdes"],
  "\\bmba\\b": ["mba"],
  "\\bb\\. ?arch": ["barch"],
  "\\bm\\.? ?arch": ["march"],
  "\\bb\\.? ?voc": ["bvoc"],
  "\\bm\\.? ?plan": ["mplan"],
  "hotel management": ["hmct"],
  "\\bbhmct": ["hmct"],
  "\\bmhm\\b": ["mhm"],
  "(\\bug\\b)|(\\bundergraduate\\b)": [
    "btech",
    "bdes",
    "barch",
    "bvoc",
    "hmct",
  ],
  "(\\bpg\\b)|(\\bpostgraduate\\b)": [
    "mtech",
    "mca",
    "mba",
    "march",
    "mplan",
    "mhm",
  ],
};

const FILTERS: Record<string, string> = {
  all: "ALL NOTIFICATIONS",
  relevant: "ALL RELEVANT NOTIFS",
  btech: "B.Tech",
  mtech: "M.Tech",
  mca: "MCA",
  phd: "PhD",
  bdes: "B.Des",
  mba: "MBA",
  barch: "B.Arch",
  march: "M.Arch",
  bvoc: "B.Voc",
  mplan: "M.Plan",
  hmct: "Hotel Management & Catering Technology",
  mhm: "MHM",
};

const COURSES: Record<string, string> = {
  btech: "B.Tech",
  mtech: "M.Tech",
  mcaTwoYear: "MCA (2 Year)",
  mcaSecondYearDirect: "MCA (Second Year Direct)",
  mcaIntegrated: "MCA Dual degree (INTEGRATED)",
  mca: "MCA",
  phd: "PhD",
  bdes: "B.Des",
  mba: "MBA",
  barch: "B.Arch",
  march: "M.Arch",
  bvoc: "B.Voc",
  mplan: "M.Plan",
  hmct: "Hotel Management & Catering Technology",
  mhm: "MHM",
};

export {
  COURSES_URL,
  PUBLISHED_RESULTS_URL,
  RESULT_URL,
  ANOUNCEMENTS_URL,
  ATTACHMENT_URL,
  ACADEMIC_CALENDAR_URL,
  TIMETABLE_URL,
  FILTERS_REGEX,
  FILTERS,
  COURSES,
};
