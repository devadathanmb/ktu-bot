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
 * Academic calendars table for storing KTU academic calendars with full-text search capabilities
 * This table stores academic calendars fetched from the KTU API and enables text-based search
 * functionality that is not provided by the external API.
 */
export const academicCalendars = pgTable(
  "academic_calendars",
  {
    // Primary key - matches the calendar ID from KTU API
    id: integer("id").primaryKey().notNull(),

    // Required fields from API
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    title: text("title").notNull(),

    // Single attachment as JSONB object for structured storage
    attachment: jsonb("attachment")
      .$type<{
        fileName: string;
        attachmentId: number;
        encryptId: string;
      }>()
      .notNull(),

    // Generated tsvector column for full-text search on title
    // Uses 'english' text search configuration for better stemming and stop words
    searchVector: tsvector("search_vector")
      .notNull()
      .generatedAlwaysAs(
        (): SQL =>
          sql`to_tsvector('english', coalesce(${academicCalendars.title}, ''))`
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
    index("academic_calendars_search_idx").using("gin", table.searchVector),
    // Index on published date for efficient date-based ordering and filtering
    index("academic_calendars_published_at_idx").on(table.publishedAt.desc()),
  ]
);
