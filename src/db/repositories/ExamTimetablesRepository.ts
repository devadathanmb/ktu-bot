import { eq, desc, sql, and, count } from "drizzle-orm";
import { db } from "../connection.js";
import { examTimetables } from "../schema/examTimetables.js";
import type { TransactionType } from "../transactions.js";
import type { ExamTimeTable } from "../../types/service.types.js";
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

// Type for inserting exam timetables into the database
type ExamTimetableInsert = typeof examTimetables.$inferInsert;

export class ExamTimetablesRepository {
  private db: DatabaseInstance;

  constructor(dbInstance: DatabaseInstance = db) {
    this.db = dbInstance;
  }

  /**
   * Get all exam timetables with optional pagination and date filtering
   */
  async getAll(options: SearchOptions = {}) {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    const conditions = [];

    // Add date filtering if provided
    if (startDate) {
      conditions.push(sql`${examTimetables.publishedAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${examTimetables.publishedAt} <= ${endDate}`);
    }

    const baseQuery = this.db.select().from(examTimetables);

    if (conditions.length > 0) {
      return baseQuery
        .where(and(...conditions))
        .orderBy(desc(examTimetables.publishedAt))
        .limit(limit)
        .offset(offset);
    }

    return baseQuery
      .orderBy(desc(examTimetables.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Search exam timetables using PostgreSQL full-text search
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
      sql`${examTimetables.searchVector} @@ to_tsquery('english', ${tsquery})`,
    ];

    // Add date filtering if provided
    if (startDate) {
      conditions.push(sql`${examTimetables.publishedAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${examTimetables.publishedAt} <= ${endDate}`);
    }

    return this.db
      .select()
      .from(examTimetables)
      .where(and(...conditions))
      .orderBy(desc(examTimetables.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get exam timetable by ID
   */
  async getById(id: number) {
    const result = await this.db
      .select()
      .from(examTimetables)
      .where(eq(examTimetables.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Get exam timetables by multiple IDs
   */
  async getByIds(ids: number[]) {
    if (ids.length === 0) return [];

    return this.db
      .select()
      .from(examTimetables)
      .where(sql`${examTimetables.id} = ANY(${ids})`)
      .orderBy(desc(examTimetables.publishedAt));
  }

  /**
   * Check if exam timetable exists
   */
  async exists(id: number): Promise<boolean> {
    const result = await this.db
      .select({ id: examTimetables.id })
      .from(examTimetables)
      .where(eq(examTimetables.id, id))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Insert a single exam timetable (upsert)
   */
  async upsert(timetable: ExamTimetableInsert) {
    return this.db
      .insert(examTimetables)
      .values({
        id: timetable.id,
        publishedAt: timetable.publishedAt,
        title: timetable.title,
        attachment: timetable.attachment,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: examTimetables.id,
        set: {
          publishedAt: timetable.publishedAt,
          title: timetable.title,
          attachment: timetable.attachment,
          updatedAt: new Date(),
        },
      })
      .returning();
  }

  /**
   * Bulk insert/upsert exam timetables
   */
  async bulkUpsert(timetableList: ExamTimetableInsert[]) {
    if (timetableList.length === 0) return [];

    const values = timetableList.map(timetable => ({
      id: timetable.id,
      publishedAt: timetable.publishedAt,
      title: timetable.title,
      attachment: timetable.attachment,
      updatedAt: new Date(),
    }));

    return this.db
      .insert(examTimetables)
      .values(values)
      .onConflictDoUpdate({
        target: examTimetables.id,
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
   * Get count of all exam timetables
   */
  async getCount(): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(examTimetables);

    return Number(result[0]?.count || 0);
  }

  /**
   * Get latest exam timetable ID (useful for sync operations)
   */
  async getLatestId(): Promise<number | null> {
    const result = await this.db
      .select({ id: examTimetables.id })
      .from(examTimetables)
      .orderBy(desc(examTimetables.id))
      .limit(1);

    return result[0]?.id || null;
  }

  /**
   * Get exam timetables published after a specific date (useful for incremental sync)
   */
  async getTimetablesSince(date: Date, limit = 100) {
    return this.db
      .select()
      .from(examTimetables)
      .where(sql`${examTimetables.publishedAt} > ${date}`)
      .orderBy(desc(examTimetables.publishedAt))
      .limit(limit);
  }

  /**
   * Delete exam timetable by ID
   */
  async delete(id: number) {
    return this.db
      .delete(examTimetables)
      .where(eq(examTimetables.id, id))
      .returning();
  }

  /**
   * Transform API timetable to database format
   */
  static transformFromApi(apiTimetable: ExamTimeTable): ExamTimetableInsert {
    return {
      id: apiTimetable.id,
      publishedAt: apiTimetable.publishedAt || new Date(),
      title: apiTimetable.title,
      attachment: {
        attachmentId: apiTimetable.attachmentId,
        fileName: apiTimetable.fileName,
        encryptId: apiTimetable.encryptId,
      },
    };
  }

  /**
   * Transform database exam timetable to API format
   */
  static transformToApi(
    dbTimetable: typeof examTimetables.$inferSelect
  ): ExamTimeTable {
    return {
      id: dbTimetable.id,
      title: dbTimetable.title,
      publishedAt: dbTimetable.publishedAt,
      formattedPublishedDate: formatDateToReadableString(
        dbTimetable.publishedAt
      ),
      attachmentId: dbTimetable.attachment.attachmentId,
      fileName: dbTimetable.attachment.fileName,
      encryptId: dbTimetable.attachment.encryptId,
    };
  }
}
