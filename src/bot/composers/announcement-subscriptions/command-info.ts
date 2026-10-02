import { emoji } from "@grammyjs/emoji";

/**
 * Static command metadata for the announcement-subscription composer. Command
 * construction and `/help` both read these entries, so the names and
 * descriptions cannot drift. This module deliberately imports nothing besides
 * the emoji helper, which keeps text-only code free of the database,
 * repositories, sessions, and the composer itself.
 */
export const announcementsSubscribeCommandInfo = {
  name: "announcements_subscribe",
  description: `${emoji("bell")} Get announcement alerts`,
} as const;

export const announcementsUnsubscribeCommandInfo = {
  name: "announcements_unsubscribe",
  description: `${emoji("prohibited")} Stop announcement alerts`,
} as const;

export const announcementsShowStatusCommandInfo = {
  name: "announcements_show_status",
  description: `${emoji("clipboard")} See your selected categories`,
} as const;

export const announcementsChangeFilterCommandInfo = {
  name: "announcements_change_filter",
  description: `${emoji("toolbox")} Change your alert categories`,
} as const;

/** Ordered exactly as `/help` presents the notification commands. */
export const announcementSubscriptionCommandInfos = [
  announcementsSubscribeCommandInfo,
  announcementsUnsubscribeCommandInfo,
  announcementsShowStatusCommandInfo,
  announcementsChangeFilterCommandInfo,
] as const;
