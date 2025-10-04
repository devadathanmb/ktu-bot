import {
  pgTable,
  integer,
  text,
  timestamp,
  jsonb,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { SQL, sql } from "drizzle-orm";

// Define custom tsvector type for PostgreSQL full-text search
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * Announcements table for storing KTU announcements with full-text search capabilities
 * This table stores announcements fetched from the KTU API and enables text-based search
 * functionality that is not provided by the external API.
 */
export const announcements = pgTable(
  "announcements",
  {
    // Primary key - matches the announcement ID from KTU API
    id: integer("id").primaryKey().notNull(),

    // Required fields from API
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),

    // Attachments as JSONB array for structured storage
    attachments: jsonb("attachments")
      .$type<
        Array<{
          fileName: string;
          encryptId: string;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),

    // Generated tsvector column combining subject and message for full-text search
    // Uses 'english' text search configuration for better stemming and stop words
    searchVector: tsvector("search_vector")
      .notNull()
      .generatedAlwaysAs(
        (): SQL => sql`to_tsvector('english',
          coalesce(${announcements.subject}, '') || ' ' ||
          coalesce(${announcements.message}, '')
        )`
      ),

    // Metadata columns for tracking when records are created/updated
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => [
    // GIN index on the tsvector column for efficient full-text search
    index("announcements_search_idx").using("gin", table.searchVector),
    // Index on published date for efficient date-based ordering and filtering
    index("announcements_published_at_idx").on(table.publishedAt.desc()),
  ]
);
