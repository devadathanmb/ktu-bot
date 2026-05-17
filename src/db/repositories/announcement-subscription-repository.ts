import { eq, arrayOverlaps } from "drizzle-orm";
import { db } from "../connection.js";
import { announcementSubscriptions } from "../schema/announcement-subscriptions.js";
import type { TransactionType } from "../transactions.js";

type DatabaseInstance = typeof db | TransactionType;

export class AnnouncementSubscriptionRepository {
  private db: DatabaseInstance;

  constructor(dbInstance: DatabaseInstance = db) {
    this.db = dbInstance;
  }

  async getBychatId(chatId: number) {
    return this.db.query.announcementSubscriptions.findFirst({
      where: eq(announcementSubscriptions.chatId, chatId),
    });
  }

  async getMatchingSubscriptions(filters: string[]) {
    return this.db
      .select()
      .from(announcementSubscriptions)
      .where(arrayOverlaps(announcementSubscriptions.filters, filters));
  }

  async create(
    subscriptionData: typeof announcementSubscriptions.$inferInsert
  ) {
    const [result] = await this.db
      .insert(announcementSubscriptions)
      .values(subscriptionData)
      .returning();
    return result;
  }

  async update(
    chatId: number,
    subscriptionData: Partial<typeof announcementSubscriptions.$inferInsert>
  ) {
    const nowTimestamp = new Date();
    subscriptionData.updatedAt = nowTimestamp;
    return this.db
      .update(announcementSubscriptions)
      .set(subscriptionData)
      .where(eq(announcementSubscriptions.chatId, chatId))
      .returning();
  }

  async delete(chatId: number) {
    return this.db
      .delete(announcementSubscriptions)
      .where(eq(announcementSubscriptions.chatId, chatId))
      .returning();
  }

  async getAll() {
    return this.db.select().from(announcementSubscriptions);
  }

  async exists(chatId: number) {
    const count = await this.db.$count(
      announcementSubscriptions,
      eq(announcementSubscriptions.chatId, chatId)
    );
    return count > 0;
  }
}
