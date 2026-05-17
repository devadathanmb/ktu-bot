import { eq, desc, sql, and, count } from "drizzle-orm";
import { db } from "../connection.js";
import { announcements } from "../schema/announcements.js";
import type { TransactionType } from "../transactions.js";
import type { Announcement } from "../../types/service.types.js";
import { formatDateToReadableString } from "../../utils/formatting.js";

type DatabaseInstance = typeof db | TransactionType;

// Interface for search options
interface SearchOptions {
  query?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

// Type for inserting announcements into the database
type AnnouncementInsert = typeof announcements.$inferInsert;

export class AnnouncementsRepository {
  private db: DatabaseInstance;

  constructor(dbInstance: DatabaseInstance = db) {
    this.db = dbInstance;
  }

  /**
   * Get all announcements with optional pagination and date filtering
   */
  async getAll(options: SearchOptions = {}) {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    const conditions = [];

    // Add date filtering if provided
    if (startDate) {
      conditions.push(sql`${announcements.publishedAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${announcements.publishedAt} <= ${endDate}`);
    }

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
      sql`${announcements.searchVector} @@ to_tsquery('english', ${tsquery})`,
    ];

    // Add date filtering if provided
    if (startDate) {
      conditions.push(sql`${announcements.publishedAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${announcements.publishedAt} <= ${endDate}`);
    }

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
  async bulkUpsert(announcementList: AnnouncementInsert[]) {
    if (announcementList.length === 0) return [];

    const values = announcementList.map(announcement => ({
      id: announcement.id,
      publishedAt: announcement.publishedAt,
      subject: announcement.subject,
      message: announcement.message,
      attachments: announcement.attachments,
      updatedAt: new Date(),
    }));

    return this.db
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
