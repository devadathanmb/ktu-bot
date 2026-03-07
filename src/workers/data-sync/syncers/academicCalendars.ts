import { AcademicCalendar } from "../../../types/service.types.js";
import { BaseResourceSyncer } from "./base.js";
import { fetchAcademicCalendars } from "../../../api/services/index.js";
import { AcademicCalendarsRepository } from "../../../db/repositories/AcademicCalendarsRepository.js";
import { withTransaction } from "../../../db/transactions.js";
import logger from "../../../utils/logger.js";

export class AcademicCalendarsSyncer extends BaseResourceSyncer {
  readonly name = "academic_calendars";

  private readonly PAGE_SIZE = 100;
  private readonly BATCH_SIZE = 20;

  private async fetchPage(
    pageNumber: number,
    options?: { log?: boolean }
  ): Promise<AcademicCalendar[]> {
    if (options?.log !== false) {
      logger.debug(
        `[${this.name}] Fetching page ${pageNumber} (size: ${this.PAGE_SIZE})`
      );
    }
    return await fetchAcademicCalendars({
      pageNumber,
      dataSize: this.PAGE_SIZE,
    });
  }

  private async *fetchCalendarsInBatches(): AsyncGenerator<
    AcademicCalendar[],
    void,
    unknown
  > {
    let pageNumber = 0;
    let hasMorePages = true;

    while (hasMorePages) {
      const batch: AcademicCalendar[] = [];

      // Fetch BATCH_SIZE pages at once
      for (let i = 0; i < this.BATCH_SIZE && hasMorePages; i++) {
        const calendars = await this.fetchPage(pageNumber);

        // If we get fewer items than PAGE_SIZE, we've reached the end
        if (calendars.length === 0) {
          hasMorePages = false;
          break;
        }

        batch.push(...calendars);
        pageNumber++;

        // If we got less than a full page, we're at the end
        if (calendars.length < this.PAGE_SIZE) {
          hasMorePages = false;
          break;
        }
      }

      // Yield the batch if we collected any calendars
      if (batch.length > 0) {
        logger.debug(
          `[${this.name}] Yielding batch with ${batch.length} calendars`
        );
        yield batch;
      }
    }

    logger.debug(`[${this.name}] Finished fetching all calendars`);
  }

  async needsInitialSync(): Promise<boolean> {
    // Check if academic calendars search table is empty
    const repo = new AcademicCalendarsRepository();
    const count = await repo.getCount();

    logger.debug(`[${this.name}] Current calendars count in DB: ${count}`);

    // If no calendars exist, we need initial sync
    return count === 0;
  }

  async performInitialSync(): Promise<void> {
    logger.info(`[${this.name}] Starting initial sync...`);

    let totalProcessed = 0;
    let batchNumber = 0;

    await withTransaction(async tx => {
      const repo = new AcademicCalendarsRepository(tx);

      for await (const batch of this.fetchCalendarsInBatches()) {
        batchNumber++;
        logger.info(
          `[${this.name}] Processing batch ${batchNumber} with ${batch.length} calendars`
        );

        const transformedBatch = batch.map(calendar =>
          AcademicCalendarsRepository.transformFromApi(calendar)
        );
        const inserted = await repo.bulkUpsert(transformedBatch);

        logger.debug(
          `[${this.name}] Batch ${batchNumber}: upserted ${inserted.length} calendars`
        );

        totalProcessed += batch.length;
        logger.info(
          `[${this.name}] Processed ${totalProcessed} calendars so far`
        );
      }
    });

    logger.info(
      `[${this.name}] Initial sync completed. Total calendars processed: ${totalProcessed}`
    );
  }

  async performPeriodicSync(): Promise<void> {
    logger.info(`[${this.name}] Starting periodic sync`);

    // Fetch recent calendars (first 2 pages to catch any recent updates)
    const recentBatch1 = await this.fetchPage(0, { log: false });
    const recentBatch2 = await this.fetchPage(1, { log: false });
    const recentCalendars = [...recentBatch1, ...recentBatch2];

    if (recentCalendars.length === 0) {
      logger.info(`[${this.name}] No recent calendars found`);
      return;
    }

    // Transform and upsert in transaction
    await withTransaction(async tx => {
      const repo = new AcademicCalendarsRepository(tx);
      const transformedCalendars = recentCalendars.map(calendar =>
        AcademicCalendarsRepository.transformFromApi(calendar)
      );
      const upserted = await repo.bulkUpsert(transformedCalendars);

      logger.info(
        `[${this.name}] Periodic sync: Processed ${upserted.length} calendars`
      );
    });

    logger.info(
      `[${this.name}] Periodic sync completed. Processed ${recentCalendars.length} calendars`
    );
  }
}
