import { Announcement } from "../../../types/service.types.js";
import { BaseResourceSyncer } from "./base.js";
import { fetchAnnouncements } from "../../../api/services/index.js";
import { AnnouncementsRepository } from "../../../db/repositories/announcements-repository.js";
import { withTransaction } from "../../../db/transactions.js";
import logger from "../../../utils/logger.js";

export class AnnouncementsSyncer extends BaseResourceSyncer {
  readonly name = "announcements";

  private readonly PAGE_SIZE = 100;
  private readonly BATCH_SIZE = 20;

  /**
   * Fetches a single page of announcements from the API
   */
  private async fetchPage(
    pageNumber: number,
    options?: { log?: boolean }
  ): Promise<Announcement[]> {
    if (options?.log !== false) {
      logger.debug(
        { syncer: this.name, pageNumber, pageSize: this.PAGE_SIZE },
        "Fetching page"
      );
    }
    return await fetchAnnouncements({
      pageNumber,
      dataSize: this.PAGE_SIZE,
      apiClient: this.apiClient,
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

      for (let i = 0; i < this.BATCH_SIZE && hasMorePages; i++) {
        const announcements = await this.fetchPage(pageNumber);

        if (announcements.length === 0) {
          hasMorePages = false;
          break;
        }

        batch.push(...announcements);
        pageNumber++;

        if (announcements.length < this.PAGE_SIZE) {
          hasMorePages = false;
          break;
        }
      }

      if (batch.length > 0) {
        logger.debug(
          { syncer: this.name, batchSize: batch.length },
          "Yielding batch"
        );
        yield batch;
      }
    }

    logger.debug({ syncer: this.name }, "Finished fetching all announcements");
  }

  async needsInitialSync(): Promise<boolean> {
    const repo = new AnnouncementsRepository();
    const count = await repo.getCount();

    logger.debug(
      { syncer: this.name, count },
      "Current announcements count in DB"
    );

    return count === 0;
  }

  async performInitialSync(): Promise<void> {
    logger.info({ syncer: this.name }, "Starting initial sync");

    let totalProcessed = 0;
    let batchNumber = 0;

    await withTransaction(async tx => {
      const repo = new AnnouncementsRepository(tx);

      for await (const batch of this.fetchAnnouncementsInBatches()) {
        batchNumber++;
        logger.info(
          { syncer: this.name, batchNumber, batchSize: batch.length },
          "Processing batch"
        );

        const transformedBatch = batch.map(announcement =>
          AnnouncementsRepository.transformFromApi(announcement)
        );
        const upserted = await repo.bulkUpsert(transformedBatch);

        logger.debug(
          { syncer: this.name, batchNumber, upsertedCount: upserted.length },
          "Batch upserted"
        );

        totalProcessed += batch.length;
        logger.info(
          { syncer: this.name, totalProcessed },
          "Processed announcements so far"
        );
      }
    });

    logger.info(
      { syncer: this.name, totalProcessed },
      "Initial sync completed"
    );
  }

  async performPeriodicSync(): Promise<void> {
    logger.info({ syncer: this.name }, "Starting periodic sync");

    const recentBatch1 = await this.fetchPage(0, { log: false });
    const recentBatch2 = await this.fetchPage(1, { log: false });
    const recentAnnouncements = [...recentBatch1, ...recentBatch2];

    if (recentAnnouncements.length === 0) {
      logger.info({ syncer: this.name }, "No recent announcements found");
      return;
    }

    await withTransaction(async tx => {
      const repo = new AnnouncementsRepository(tx);
      const transformedAnnouncements = recentAnnouncements.map(announcement =>
        AnnouncementsRepository.transformFromApi(announcement)
      );
      const upserted = await repo.bulkUpsert(transformedAnnouncements);

      logger.info(
        { syncer: this.name, processedCount: upserted.length },
        "Periodic sync processed announcements"
      );
    });

    logger.info(
      { syncer: this.name, processedCount: recentAnnouncements.length },
      "Periodic sync completed"
    );
  }
}
