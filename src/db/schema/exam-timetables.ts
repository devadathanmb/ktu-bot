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

export const examTimetables = pgTable(
  "exam_timetables",
  {
    id: integer("id").primaryKey().notNull(),

    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    title: text("title").notNull(),

    // Single attachment as JSONB object for structured storage
    attachment: jsonb("attachment")
      .$type<{
        fileName: string | null;
        encryptId: string | null;
        attachmentId: number | null;
      }>()
      .notNull(),

    searchVector: tsvector("search_vector")
      .notNull()
      .generatedAlwaysAs(
        (): SQL =>
          sql`to_tsvector('english', coalesce(${examTimetables.title}, ''))`
      ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => [
    // GIN index on the tsvector column for efficient full-text search
    index("exam_timetables_search_idx").using("gin", table.searchVector),
    // Index on published date for efficient date-based ordering and filtering
    index("exam_timetables_published_at_idx").on(table.publishedAt.desc()),
  ]
);
