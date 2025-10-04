// Script to migrate data from old bot's firestore DB to new bot's postgres DB
import { initDB } from "../src/db/connection.js";
import {
  AnnouncementSubscriptionRepository,
  ChatRepository,
} from "../src/db/index.js";
import { withTransaction } from "../src/db/transactions.js";
import logger from "../src/utils/logger.js";
import * as subscribedUsers from "./subscribedUsers.json" with { type: "json" };

async function migrateData() {
  await initDB();
  await withTransaction(async tx => {
    try {
      logger.debug("Starting data migration...");
      for (const userData of subscribedUsers.default) {
        logger.debug(userData, `Migrating user`);
        // 1. Create a chat object if not exists
        const chatRepo = new ChatRepository(tx);
        const chat = await chatRepo.createIfNotExists(userData.chatId);
        logger.debug(chat, `Created chat record: ${chat?.chatId}`);

        // 2. Subscribe to announcements if opted in
        const announcementsSubscriptionRepo =
          new AnnouncementSubscriptionRepository(tx);
        const subscription = await announcementsSubscriptionRepo.create({
          chatId: userData.chatId,
          filters: [userData.courseFilter?.toUpperCase() || "RELEVANT"],
        });
        logger.debug(
          subscription,
          `Created subscription record: ${subscription?.id}`
        );
      }
    } catch (error) {
      tx.rollback();
      logger.error(error, "Data migration failed: ");
    } finally {
      // Rollback for safety now
    }
  });
}

await migrateData();
