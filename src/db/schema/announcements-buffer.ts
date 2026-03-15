import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";

// This is a temporary buffer table to keep track of announcements that have been processed recently
// It serves no real purpose just for keeping track of recently processed announcements
export const announcementsBuffer = pgTable("announcements_buffer", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id").notNull().unique(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
