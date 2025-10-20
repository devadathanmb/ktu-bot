// KTU API constants
export const KTU_API_ORIGIN_URL = "https://ktu.edu.in";
export const KTU_API_REFERER_URL = "https://ktu.edu.in/";
export const KTU_API_BASE_URI = "https://api.ktu.edu.in";

// KTU Web Portal API (for announcements, timetables, etc.)
export const KTU_API_WEBPORTAL_API_URI =
  "https://api.ktu.edu.in/ktu-web-portal-api/anon";
export const KTU_API_ENDPOINTS = {
  RECAPTCHA_SCRIPT: `${KTU_API_WEBPORTAL_API_URI}/get?key=v3`,
  ANNOUNCEMENTS: `${KTU_API_WEBPORTAL_API_URI}/announcemnts`,
  ATTACHMENT: `${KTU_API_WEBPORTAL_API_URI}/getAttachment`,
  TIMETABLES: `${KTU_API_WEBPORTAL_API_URI}/timetable`,
  ACADEMIC_CALENDAR: `${KTU_API_WEBPORTAL_API_URI}/academicCalendar`,
} as const;

// External API endpoints:
// Hugging Face Inference API for text relevancy (used for announcements filtering)
const HUGGING_FACE_BASE_URI = "https://api-inference.huggingface.co";
export const HUGGING_FACE_API = {
  BASE_URI: HUGGING_FACE_BASE_URI,
  RELEVANCY_ENDPOINT: `${HUGGING_FACE_BASE_URI}/models/devadathanmb/ktu-notifs-relevancy-bert`,
} as const;

// Uptime Robot API
const UPTIME_ROBOT_BASE_URI = "https://api.uptimerobot.com/v2";
export const UPTIME_ROBOT_API = {
  BASE_URI: UPTIME_ROBOT_BASE_URI,
  MONITORS_ENDPOINT: `${UPTIME_ROBOT_BASE_URI}/getMonitors`,
  STATS_PAGE: "https://stats.uptimerobot.com/Drq58GdQoC",
} as const;

// Litterbox (Catbox) API for temporary file uploads (used for attachments broadcasting)
const LITTERBOX_BASE_URI = "https://litterbox.catbox.moe";
export const LITTERBOX_API = {
  BASE_URI: LITTERBOX_BASE_URI,
  UPLOAD_ENDPOINT: `${LITTERBOX_BASE_URI}/resources/internals/api.php`,
} as const;

// Better Uptime API for uptime monitoring
const BETTER_UPTIME_BASE_URI = "https://uptime.betterstack.com/api/v2";
export const BETTER_UPTIME_API = {
  BASE_URI: BETTER_UPTIME_BASE_URI,
  MONITORS_ENDPOINT: `${BETTER_UPTIME_BASE_URI}/monitors`,
  MONITOR_GROUPS_ENDPOINT: `${BETTER_UPTIME_BASE_URI}/monitor-groups`,
  INCIDENTS_ENDPOINT: "https://uptime.betterstack.com/api/v3/incidents",
  STATS_PAGE: "https://ktu-bot.betteruptime.com/",
} as const;
