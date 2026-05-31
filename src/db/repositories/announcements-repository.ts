import { eq, desc, sql, and, count } from "drizzle-orm";
import { getDb } from "../connection.js";
import { announcements } from "../schema/announcements.js";
import { DatabaseInstance } from "../types.js";
import type { Announcement } from "../../types/service.types.js";
import { formatDateToReadableString } from "../../utils/formatting.js";
import {
  buildDateRangeConditions,
  buildFullTextSearchCondition,
  normalizeSearchQuery,
  type SearchOptions,
} from "./search-utils.js";

// Type for inserting announcements into the database
type AnnouncementInsert = typeof announcements.$inferInsert;

export class AnnouncementsRepository {
  private db: DatabaseInstance;

  constructor(dbInstance: DatabaseInstance = getDb()) {
    this.db = dbInstance;
  }

  /**
   * Get all announcements with optional pagination and date filtering
   */
  async getAll(options: SearchOptions = {}) {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    const conditions = buildDateRangeConditions(announcements.publishedAt, {
      startDate,
      endDate,
    });

    const baseQuery = this.db.select().from(announcements);

    if (conditions.length > 0) {
      return baseQuery
        .where(and(...conditions))
        .orderBy(desc(announcements.publishedAt))
        .limit(limit)
        .offset(offset);
    }

    return baseQuery
      .orderBy(desc(announcements.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Search announcements using PostgreSQL full-text search
   */
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
      buildFullTextSearchCondition(announcements.searchVector, tsquery),
      ...buildDateRangeConditions(announcements.publishedAt, {
        startDate,
        endDate,
      }),
    ];

    return this.db
      .select()
      .from(announcements)
      .where(and(...conditions))
      .orderBy(desc(announcements.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get announcement by ID
   */
  async getById(id: number) {
    const result = await this.db
      .select()
      .from(announcements)
      .where(eq(announcements.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Bulk insert/upsert announcements
   */
  async bulkUpsert(announcementList: AnnouncementInsert[]): Promise<number> {
    if (announcementList.length === 0) return 0;

    const values = announcementList.map(announcement => ({
      id: announcement.id,
      publishedAt: announcement.publishedAt,
      subject: announcement.subject,
      message: announcement.message,
      attachments: announcement.attachments,
      updatedAt: new Date(),
    }));

    const result = await this.db
      .insert(announcements)
      .values(values)
      .onConflictDoUpdate({
        target: announcements.id,
        set: {
          publishedAt: sql.raw(`EXCLUDED.published_at`),
          subject: sql.raw(`EXCLUDED.subject`),
          message: sql.raw(`EXCLUDED.message`),
          attachments: sql.raw(`EXCLUDED.attachments`),
          updatedAt: sql.raw(`EXCLUDED.updated_at`),
        },
      })
      .returning();

    return result.length;
  }

  /**
   * Get count of all announcements
   */
  async getCount(): Promise<number> {
    const result = await this.db.select({ count: count() }).from(announcements);

    return Number(result[0]?.count || 0);
  }

  /**
   * Transform API announcement to database format
   */
  static transformFromApi(apiAnnouncement: Announcement): AnnouncementInsert {
    return {
      id: apiAnnouncement.id,
      publishedAt: apiAnnouncement.publishedAt || new Date(),
      subject: apiAnnouncement.subject,
      message: apiAnnouncement.message,
      attachments: apiAnnouncement.attachments.map(attachment => ({
        fileName: attachment.name,
        encryptId: attachment.encryptId,
      })),
    };
  }

  /**
   * Transform database announcement to API format
   */
  static transformToApi(
    dbAnnouncement: typeof announcements.$inferSelect
  ): Announcement {
    return {
      id: dbAnnouncement.id,
      subject: dbAnnouncement.subject,
      message: dbAnnouncement.message,
      publishedAt: dbAnnouncement.publishedAt,
      formattedPublishedDate: formatDateToReadableString(
        dbAnnouncement.publishedAt
      ),
      attachments: dbAnnouncement.attachments.map(attachment => ({
        name: attachment.fileName,
        encryptId: attachment.encryptId,
      })),
    };
  }
}
