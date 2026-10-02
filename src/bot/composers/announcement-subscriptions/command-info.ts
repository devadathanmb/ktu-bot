/**
 * Static command metadata for the announcement-subscription composer. Command
 * construction and `/help` both read these entries, so the names and
 * descriptions cannot drift. Keep this module free of the database,
 * repositories, sessions, and initialized composers.
 */
export const announcementsSubscribeCommandInfo = {
  name: "announcements_subscribe",
  description: "Turn on alerts",
} as const;

export const announcementsUnsubscribeCommandInfo = {
  name: "announcements_unsubscribe",
  description: "Turn off alerts",
} as const;

export const announcementsShowStatusCommandInfo = {
  name: "announcements_show_status",
  description: "View your categories",
} as const;

export const announcementsChangeFilterCommandInfo = {
  name: "announcements_change_filter",
  description: "Change your categories",
} as const;

/** Ordered exactly as `/help` presents the notification commands. */
export const announcementSubscriptionCommandInfos = [
  announcementsSubscribeCommandInfo,
  announcementsUnsubscribeCommandInfo,
  announcementsShowStatusCommandInfo,
  announcementsChangeFilterCommandInfo,
] as const;
