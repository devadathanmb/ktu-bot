/**
 * Static command metadata for the announcement-subscription composer. Command
 * construction and `/help` both read these entries, so the names and
 * descriptions cannot drift. Keep this module free of the database,
 * repositories, sessions, and initialized composers.
 */
export const announcementsSubscribeCommandInfo = {
  name: "announcements_subscribe",
  description: "Get new announcements in this chat",
} as const;

export const announcementsUnsubscribeCommandInfo = {
  name: "announcements_unsubscribe",
  description: "Stop announcement alerts",
} as const;

export const announcementsShowStatusCommandInfo = {
  name: "announcements_show_status",
  description: "See the categories you follow",
} as const;

export const announcementsChangeFilterCommandInfo = {
  name: "announcements_change_filter",
  description: "Change the categories you follow",
} as const;

/** Ordered exactly as `/help` presents the notification commands. */
export const announcementSubscriptionCommandInfos = [
  announcementsSubscribeCommandInfo,
  announcementsUnsubscribeCommandInfo,
  announcementsShowStatusCommandInfo,
  announcementsChangeFilterCommandInfo,
] as const;
