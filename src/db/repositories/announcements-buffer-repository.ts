import { eq, desc } from "drizzle-orm";
import { db } from "../connection.js";
import { announcementsBuffer } from "../schema/announcements-buffer.js";
import { DatabaseInstance } from "../types.js";

export class AnnouncementsBufferRepository {
  private db: DatabaseInstance;

  constructor(dbInstance: DatabaseInstance = db) {
    this.db = dbInstance;
  }

  async getAll() {
    return this.db
      .select()
      .from(announcementsBuffer)
      .orderBy(desc(announcementsBuffer.refreshedAt));
  }

  async getAllAnnouncementIds() {
    const result = await this.db
      .select({ announcementId: announcementsBuffer.announcementId })
      .from(announcementsBuffer)
      .orderBy(desc(announcementsBuffer.refreshedAt));

    return result.map(row => row.announcementId);
  }

  async addAll(announcementIds: number[]) {
    const values = announcementIds.map(announcementId => ({
      announcementId,
    }));

    return this.db.insert(announcementsBuffer).values(values).returning();
  }

  async exists(announcementId: number) {
    const result = await this.db
      .select({ id: announcementsBuffer.id })
      .from(announcementsBuffer)
      .where(eq(announcementsBuffer.announcementId, announcementId))
      .limit(1);

    return result.length > 0;
  }

  async clear(): Promise<void> {
    await this.db.delete(announcementsBuffer);
  }
}
