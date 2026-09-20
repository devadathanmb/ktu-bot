import { eq, desc, sql, and, count } from "drizzle-orm";
import { examTimetables } from "../schema/exam-timetables.js";
import { DatabaseInstance } from "../types.js";
import type { ExamTimeTable } from "../../types/service.types.js";
import { formatDateToReadableString } from "../../utils/formatting.js";
import {
  buildDateRangeConditions,
  buildFullTextSearchCondition,
  normalizeSearchQuery,
  type SearchOptions,
} from "./search-utils.js";

type ExamTimetableInsert = typeof examTimetables.$inferInsert;

export class ExamTimetablesRepository {
  private db: DatabaseInstance;

  constructor(dbInstance: DatabaseInstance) {
    this.db = dbInstance;
  }

  async getAll(options: SearchOptions = {}) {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    const conditions = buildDateRangeConditions(examTimetables.publishedAt, {
      startDate,
      endDate,
    });

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
      buildFullTextSearchCondition(examTimetables.searchVector, tsquery),
      ...buildDateRangeConditions(examTimetables.publishedAt, {
        startDate,
        endDate,
      }),
    ];

    return this.db
      .select()
      .from(examTimetables)
      .where(and(...conditions))
      .orderBy(desc(examTimetables.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  async getById(id: number) {
    const result = await this.db
      .select()
      .from(examTimetables)
      .where(eq(examTimetables.id, id))
      .limit(1);

    return result[0];
  }

  async bulkUpsert(timetableList: ExamTimetableInsert[]): Promise<number> {
    if (timetableList.length === 0) return 0;

    const values = timetableList.map(timetable => ({
      id: timetable.id,
      publishedAt: timetable.publishedAt,
      title: timetable.title,
      attachment: timetable.attachment,
      updatedAt: new Date(),
    }));

    const result = await this.db
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

    return result.length;
  }

  async getCount(): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(examTimetables);

    return Number(result[0]?.count || 0);
  }

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
