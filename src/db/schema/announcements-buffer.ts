import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const announcementsBuffer = pgTable("announcements_buffer", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id").notNull().unique(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
