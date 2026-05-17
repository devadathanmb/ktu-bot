// KTU API constants
export const KTU_API_ORIGIN_URL = "https://ktu.edu.in";
export const KTU_API_REFERER_URL = "https://ktu.edu.in/";
export const KTU_API_BASE_URI = "https://api.ktu.edu.in";

// KTU Web Portal API (for announcements, timetables, etc.)
export const KTU_API_WEBPORTAL_API_URI =
  "https://api.ktu.edu.in/ktu-web-portal-api/anon";

// KTU Service API (for syllabus lookup — different path prefix)
export const KTU_API_SERVICE_URI =
  "https://api.ktu.edu.in/ktu-web-portal-api/service/anon";
export const KTU_API_SERVICE_ENDPOINTS = {
  GET_PROGRAMS: `${KTU_API_SERVICE_URI}/getprograms`,
  GET_SCHEMES: `${KTU_API_SERVICE_URI}/scheme`,
  GET_BRANCHES: `${KTU_API_SERVICE_URI}/branchAccordingToScheme`,
  GET_SYLLABUS: `${KTU_API_SERVICE_URI}/getSyllabus`,
  SYLLABUS_ATTACHMENT: `${KTU_API_SERVICE_URI}/getAttachments`,
} as const;
export const KTU_API_ENDPOINTS = {
  RECAPTCHA_SCRIPT: `${KTU_API_WEBPORTAL_API_URI}/get?key=v3`,
  ANNOUNCEMENTS: `${KTU_API_WEBPORTAL_API_URI}/announcemnts`,
  ATTACHMENT: `${KTU_API_WEBPORTAL_API_URI}/getAttachment`,
  TIMETABLES: `${KTU_API_WEBPORTAL_API_URI}/timetable`,
  ACADEMIC_CALENDAR: `${KTU_API_WEBPORTAL_API_URI}/academicCalendar`,
} as const;

// Uptime Robot API
const UPTIME_ROBOT_BASE_URI = "https://api.uptimerobot.com/v2";
export const UPTIME_ROBOT_API = {
  BASE_URI: UPTIME_ROBOT_BASE_URI,
  MONITORS_ENDPOINT: `${UPTIME_ROBOT_BASE_URI}/getMonitors`,
  STATS_PAGE: "https://stats.uptimerobot.com/Drq58GdQoC",
} as const;

// Catbox API for temporary file uploads (used for attachments broadcasting)
const CATBOX_BASE_URI = "https://catbox.moe";
export const CATBOX_API = {
  BASE_URI: CATBOX_BASE_URI,
  UPLOAD_ENDPOINT: `${CATBOX_BASE_URI}/user/api.php`,
} as const;

// Better Uptime API for uptime monitoring
const BETTER_UPTIME_BASE_URI = "https://uptime.betterstack.com/api/v2";
export const BETTER_UPTIME_API = {
  BASE_URI: BETTER_UPTIME_BASE_URI,
  MONITORS_ENDPOINT: `${BETTER_UPTIME_BASE_URI}/monitors`,
  MONITOR_GROUPS_ENDPOINT: `${BETTER_UPTIME_BASE_URI}/monitor-groups`,
  STATS_PAGE: "https://ktu-bot.betteruptime.com/",
} as const;
