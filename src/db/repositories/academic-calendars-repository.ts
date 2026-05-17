import { eq, desc, sql, and, count } from "drizzle-orm";
import { db } from "../connection.js";
import { academicCalendars } from "../schema/academic-calendars.js";
import { DatabaseInstance } from "../types.js";
import type { AcademicCalendar } from "../../types/service.types.js";
import { formatDateToReadableString } from "../../utils/formatting.js";

// Interface for search options
interface SearchOptions {
  query?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

// Type for inserting academic calendars into the database
type AcademicCalendarInsert = typeof academicCalendars.$inferInsert;

export class AcademicCalendarsRepository {
  private db: DatabaseInstance;

  constructor(dbInstance: DatabaseInstance = db) {
    this.db = dbInstance;
  }

  /**
   * Get all academic calendars with optional pagination and date filtering
   */
  async getAll(options: SearchOptions = {}) {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    const conditions = [];

    // Add date filtering if provided
    if (startDate) {
      conditions.push(sql`${academicCalendars.publishedAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${academicCalendars.publishedAt} <= ${endDate}`);
    }

    const baseQuery = this.db.select().from(academicCalendars);

    if (conditions.length > 0) {
      return baseQuery
        .where(and(...conditions))
        .orderBy(desc(academicCalendars.publishedAt))
        .limit(limit)
        .offset(offset);
    }

    return baseQuery
      .orderBy(desc(academicCalendars.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Search academic calendars using PostgreSQL full-text search
   */
  async search(searchQuery: string, options: SearchOptions = {}) {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    if (!searchQuery.trim()) {
      return this.getAll(options);
    }

    // Convert search query to tsquery format
    // This handles basic search with AND logic between words
    const tsquery = searchQuery
      .trim()
      .split(/\s+/)
      .map(word => word.replace(/[^a-zA-Z0-9]/g, ""))
      .filter(word => word.length > 0)
      .join(" & ");

    if (!tsquery) {
      return this.getAll(options);
    }

    const conditions = [
      sql`${academicCalendars.searchVector} @@ to_tsquery('english', ${tsquery})`,
    ];

    // Add date filtering if provided
    if (startDate) {
      conditions.push(sql`${academicCalendars.publishedAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${academicCalendars.publishedAt} <= ${endDate}`);
    }

    return this.db
      .select()
      .from(academicCalendars)
      .where(and(...conditions))
      .orderBy(desc(academicCalendars.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get academic calendar by ID
   */
  async getById(id: number) {
    const result = await this.db
      .select()
      .from(academicCalendars)
      .where(eq(academicCalendars.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Bulk insert/upsert academic calendars
   */
  async bulkUpsert(calendarList: AcademicCalendarInsert[]) {
    if (calendarList.length === 0) return [];

    const values = calendarList.map(calendar => ({
      id: calendar.id,
      publishedAt: calendar.publishedAt,
      title: calendar.title,
      attachment: calendar.attachment,
      updatedAt: new Date(),
    }));

    return this.db
      .insert(academicCalendars)
      .values(values)
      .onConflictDoUpdate({
        target: academicCalendars.id,
        set: {
          publishedAt: sql.raw(`EXCLUDED.published_at`),
          title: sql.raw(`EXCLUDED.title`),
          attachment: sql.raw(`EXCLUDED.attachment`),
          updatedAt: sql.raw(`EXCLUDED.updated_at`),
        },
      })
      .returning();
  }

  /**
   * Get count of all academic calendars
   */
  async getCount(): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(academicCalendars);

    return Number(result[0]?.count || 0);
  }

  /**
   * Transform API academic calendar to database format
   */
  static transformFromApi(
    apiCalendar: AcademicCalendar
  ): AcademicCalendarInsert {
    return {
      id: apiCalendar.id,
      publishedAt: apiCalendar.publishedAt || new Date(),
      title: apiCalendar.title,
      attachment: {
        fileName: apiCalendar.attachmentName,
        attachmentId: apiCalendar.attachmentId,
        encryptId: apiCalendar.encryptId,
      },
    };
  }

  /**
   * Transform database academic calendar to API format
   */
  static transformToApi(
    dbCalendar: typeof academicCalendars.$inferSelect
  ): AcademicCalendar {
    return {
      id: dbCalendar.id,
      title: dbCalendar.title,
      publishedAt: dbCalendar.publishedAt,
      formattedPublishedDate: formatDateToReadableString(
        dbCalendar.publishedAt
      ),
      attachmentName: dbCalendar.attachment.fileName,
      attachmentId: dbCalendar.attachment.attachmentId,
      encryptId: dbCalendar.attachment.encryptId,
    };
  }
}
