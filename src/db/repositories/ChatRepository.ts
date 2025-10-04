import { eq } from "drizzle-orm";
import { db } from "../connection.js";
import { chats } from "../schema/chats.js";
import type { TransactionType } from "../transactions.js";
import logger from "../../utils/logger.js";

// Type for database instance (either db or transaction)
type DatabaseInstance = typeof db | TransactionType;

export class ChatRepository {
  private db: DatabaseInstance;

  constructor(dbInstance: DatabaseInstance = db) {
    this.db = dbInstance;
  }

  async createIfNotExists(chatId: number) {
    let chat = await this.getBychatId(chatId);
    if (!chat) {
      logger.info(`Chat ID ${chatId} not found in DB, creating new record`);
      [chat] = await this.create({ chatId });
    }
    return chat;
  }

  async markActive(chatId: number) {
    let chat = await this.getBychatId(chatId);
    if (chat && chat.kickedAt) {
      [chat] = await this.update(chat.id, {
        kickedAt: null,
        updatedAt: new Date(),
      });
    }
    return chat;
  }

  async markKicked(chatId: number) {
    let chat = await this.getBychatId(chatId);
    if (chat) {
      const nowTimestamp = new Date();
      [chat] = await this.update(chat.id, {
        kickedAt: nowTimestamp,
        updatedAt: nowTimestamp,
      });
    }
    return chat;
  }

  async getBychatId(chatId: number) {
    const [chat] = await this.db
      .select()
      .from(chats)
      .where(eq(chats.chatId, chatId))
      .limit(1);
    return chat;
  }

  async create(chatData: typeof chats.$inferInsert) {
    return this.db.insert(chats).values(chatData).returning();
  }

  async update(id: number, chatData: Partial<typeof chats.$inferInsert>) {
    const nowTimestamp = new Date();
    chatData.updatedAt = nowTimestamp;
    return this.db
      .update(chats)
      .set(chatData)
      .where(eq(chats.id, id))
      .returning();
  }

  async delete(id: number) {
    return this.db.delete(chats).where(eq(chats.id, id)).returning();
  }

  async getById(id: number) {
    return this.db.select().from(chats).where(eq(chats.id, id)).limit(1);
  }

  async exists(chatId: number) {
    const count = await this.db.$count(chats, eq(chats.chatId, chatId));
    return count > 0;
  }
}
