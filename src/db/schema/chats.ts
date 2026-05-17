import { pgTable, timestamp, bigint } from "drizzle-orm/pg-core";

// Tracks chat IDs for analytics and broadcasts; never stores personal data
// Named "chats" to align with Telegram terminology (private chat, group, channel)
export const chats = pgTable("chats", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  // Tracks if user blocked the bot or bot was removed from group/channel
  // Non-null = kicked/inactive; null = active
  kickedAt: timestamp("kicked_at", { withTimezone: true }),
});
