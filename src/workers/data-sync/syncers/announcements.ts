import { Announcement } from "../../../types/service.types.js";
import { BaseResourceSyncer } from "./base.js";
import { fetchAnnouncements } from "../../../api/services/index.js";
import { AnnouncementsRepository } from "../../../db/repositories/AnnouncementsRepository.js";
import { withTransaction } from "../../../db/transactions.js";
import logger from "../../../utils/logger.js";

export class AnnouncementsSyncer extends BaseResourceSyncer {
  readonly name = "announcements";

  private readonly PAGE_SIZE = 100;
  private readonly BATCH_SIZE = 20;

  /**
   * Fetches a single page of announcements from the API
   */
  private async fetchPage(pageNumber: number): Promise<Announcement[]> {
    logger.debug(
      `[${this.name}] Fetching page ${pageNumber} (size: ${this.PAGE_SIZE})`
    );
    return await fetchAnnouncements({
      pageNumber,
      dataSize: this.PAGE_SIZE,
      cache: false, // Always fetch fresh data during sync
    });
  }

  private async *fetchAnnouncementsInBatches(): AsyncGenerator<
    Announcement[],
    void,
    unknown
  > {
    let pageNumber = 0;
    let hasMorePages = true;

    while (hasMorePages) {
      const batch: Announcement[] = [];

      // Fetch BATCH_SIZE pages at once
      for (let i = 0; i < this.BATCH_SIZE && hasMorePages; i++) {
        const announcements = await this.fetchPage(pageNumber);

        // If we get fewer items than PAGE_SIZE, we've reached the end
        if (announcements.length === 0) {
          hasMorePages = false;
          break;
        }

        batch.push(...announcements);
        pageNumber++;

        // If we got less than a full page, we're at the end
        if (announcements.length < this.PAGE_SIZE) {
          hasMorePages = false;
          break;
        }
      }

      // Yield the batch if we collected any announcements
      if (batch.length > 0) {
        logger.debug(
          `[${this.name}] Yielding batch with ${batch.length} announcements`
        );
        yield batch;
      }
    }

    logger.debug(`[${this.name}] Finished fetching all announcements`);
  }

  async needsInitialSync(): Promise<boolean> {
    // Check if announcements search table is empty
    const repo = new AnnouncementsRepository();
    const count = await repo.getCount();

    logger.debug(`[${this.name}] Current announcements count in DB: ${count}`);

    // If no announcements exist, we need initial sync
    return count === 0;
  }

  async performInitialSync(): Promise<void> {
    logger.info(`[${this.name}] Starting initial sync...`);

    let totalProcessed = 0;
    let batchNumber = 0;

    await withTransaction(async tx => {
      const repo = new AnnouncementsRepository(tx);

      for await (const batch of this.fetchAnnouncementsInBatches()) {
        batchNumber++;
        logger.info(
          `[${this.name}] Processing batch ${batchNumber} with ${batch.length} announcements`
        );

        const transformedBatch = batch.map(announcement =>
          AnnouncementsRepository.transformFromApi(announcement)
        );
        const upserted = await repo.bulkUpsert(transformedBatch);

        logger.debug(
          `[${this.name}] Batch ${batchNumber}: upserted ${upserted.length} announcements`
        );

        totalProcessed += batch.length;
        logger.info(
          `[${this.name}] Processed ${totalProcessed} announcements so far`
        );
      }
    });

    logger.info(
      `[${this.name}] Initial sync completed. Total announcements processed: ${totalProcessed}`
    );
  }

  async performPeriodicSync(): Promise<void> {
    logger.debug(`[${this.name}] Starting periodic sync`);

    try {
      // Fetch recent announcements (first 2 pages to catch any recent updates)
      const recentBatch1 = await this.fetchPage(0);
      const recentBatch2 = await this.fetchPage(1);
      const recentAnnouncements = [...recentBatch1, ...recentBatch2];

      if (recentAnnouncements.length === 0) {
        logger.debug(`[${this.name}] No recent announcements found`);
        return;
      }

      // Transform and upsert in transaction
      await withTransaction(async tx => {
        const repo = new AnnouncementsRepository(tx);
        const transformedAnnouncements = recentAnnouncements.map(announcement =>
          AnnouncementsRepository.transformFromApi(announcement)
        );
        const upserted = await repo.bulkUpsert(transformedAnnouncements);

        logger.debug(
          `[${this.name}] Periodic sync: Processed ${upserted.length} announcements`
        );
      });

      logger.debug(
        `[${this.name}] Periodic sync completed. Processed ${recentAnnouncements.length} announcements`
      );
    } catch (error) {
      logger.error(
        { error, syncer: this.name },
        `[${this.name}] Periodic sync failed`
      );
      throw error;
    }
  }
}
