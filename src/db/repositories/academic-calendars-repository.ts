import { eq, desc, sql, and, count } from "drizzle-orm";
import { academicCalendars } from "../schema/academic-calendars.js";
import { DatabaseInstance } from "../types.js";
import type { AcademicCalendar } from "../../types/service.types.js";
import { formatDateToReadableString } from "../../utils/formatting.js";
import {
  buildDateRangeConditions,
  buildFullTextSearchCondition,
  normalizeSearchQuery,
  type SearchOptions,
} from "./search-utils.js";

type AcademicCalendarInsert = typeof academicCalendars.$inferInsert;

export class AcademicCalendarsRepository {
  private db: DatabaseInstance;

  constructor(dbInstance: DatabaseInstance) {
    this.db = dbInstance;
  }

  async getAll(options: SearchOptions = {}) {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    const conditions = buildDateRangeConditions(academicCalendars.publishedAt, {
      startDate,
      endDate,
    });

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

  async search(searchQuery: string, options: SearchOptions = {}) {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    if (!searchQuery.trim()) {
      return this.getAll(options);
    }

    const tsquery = normalizeSearchQuery(searchQuery);

    if (!tsquery) {
      return this.getAll(options);
    }

    const conditions = [
      buildFullTextSearchCondition(academicCalendars.searchVector, tsquery),
      ...buildDateRangeConditions(academicCalendars.publishedAt, {
        startDate,
        endDate,
      }),
    ];

    return this.db
      .select()
      .from(academicCalendars)
      .where(and(...conditions))
      .orderBy(desc(academicCalendars.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  async getById(id: number) {
    const result = await this.db
      .select()
      .from(academicCalendars)
      .where(eq(academicCalendars.id, id))
      .limit(1);

    return result[0];
  }

  async bulkUpsert(calendarList: AcademicCalendarInsert[]): Promise<number> {
    if (calendarList.length === 0) return 0;

    const values = calendarList.map(calendar => ({
      id: calendar.id,
      publishedAt: calendar.publishedAt,
      title: calendar.title,
      attachment: calendar.attachment,
      updatedAt: new Date(),
    }));

    const result = await this.db
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

    return result.length;
  }

  async getCount(): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(academicCalendars);

    return Number(result[0]?.count || 0);
  }

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
