import {
  pgTable,
  serial,
  timestamp,
  bigint,
  pgEnum,
} from "drizzle-orm/pg-core";
import { AnnouncementFilter } from "../../constants/courses.js";
import { chats } from "./chats.js";

const ANNOUNCEMENT_FILTER_VALUES = Object.values(AnnouncementFilter) as [
  string,
  ...string[],
];
export const announcementFilterEnum = pgEnum(
  "announcement_filter",
  ANNOUNCEMENT_FILTER_VALUES
);

export const announcementSubscriptions = pgTable("announcement_subscriptions", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => chats.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  filters: announcementFilterEnum("filters")
    .array()
    .notNull()
    .default([AnnouncementFilter.ALL]),
});
