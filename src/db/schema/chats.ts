import { pgTable, timestamp, bigint } from "drizzle-orm/pg-core";

// This table is only used for analytics and broadcast purposes if required
// This can be useful when users needs to be alerted about important updates or so on
// NOTE: This resource should never track any personal data except the chat ID
// This resource is named "chats" to align with telegram terminology
// A "chat" can be a private chat with a user, a group, or a channel
export const chats = pgTable("chats", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  // Kicked is a telegram terminology used for the following things:
  // 1. User has blocked the bot in a private chat
  // 2. Bot has been removed from a group or channel
  // We use this field to track if the user has blocked the bot or the bot has been removed
  // If this field is set, we consider the user as "kicked"
  // If this field is null, we consider the user as "active"
  kickedAt: timestamp("kicked_at", { withTimezone: true }),
});
