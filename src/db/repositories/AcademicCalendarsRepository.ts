import { eq, desc, sql, and, count } from "drizzle-orm";
import { db } from "../connection.js";
import { academicCalendars } from "../schema/academicCalendars.js";
import type { TransactionType } from "../transactions.js";
import type { AcademicCalendar } from "../../types/service.types.js";
import { formatDateToReadableString } from "../../utils/formatting.js";

// Type for database instance (either db or transaction)
type DatabaseInstance = typeof db | TransactionType;

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
   * Get academic calendars by multiple IDs
   */
  async getByIds(ids: number[]) {
    if (ids.length === 0) return [];

    return this.db
      .select()
      .from(academicCalendars)
      .where(sql`${academicCalendars.id} = ANY(${ids})`)
      .orderBy(desc(academicCalendars.publishedAt));
  }

  /**
   * Check if academic calendar exists
   */
  async exists(id: number): Promise<boolean> {
    const result = await this.db
      .select({ id: academicCalendars.id })
      .from(academicCalendars)
      .where(eq(academicCalendars.id, id))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Insert a single academic calendar (upsert)
   */
  async upsert(calendar: AcademicCalendarInsert) {
    return this.db
      .insert(academicCalendars)
      .values({
        id: calendar.id,
        publishedAt: calendar.publishedAt,
        title: calendar.title,
        attachment: calendar.attachment,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: academicCalendars.id,
        set: {
          publishedAt: calendar.publishedAt,
          title: calendar.title,
          attachment: calendar.attachment,
          updatedAt: new Date(),
        },
      })
      .returning();
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
   * Get latest academic calendar ID (useful for sync operations)
   */
  async getLatestId(): Promise<number | null> {
    const result = await this.db
      .select({ id: academicCalendars.id })
      .from(academicCalendars)
      .orderBy(desc(academicCalendars.id))
      .limit(1);

    return result[0]?.id || null;
  }

  /**
   * Get academic calendars published after a specific date (useful for incremental sync)
   */
  async getCalendarsSince(date: Date, limit = 100) {
    return this.db
      .select()
      .from(academicCalendars)
      .where(sql`${academicCalendars.publishedAt} > ${date}`)
      .orderBy(desc(academicCalendars.publishedAt))
      .limit(limit);
  }

  /**
   * Delete academic calendar by ID
   */
  async delete(id: number) {
    return this.db
      .delete(academicCalendars)
      .where(eq(academicCalendars.id, id))
      .returning();
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
