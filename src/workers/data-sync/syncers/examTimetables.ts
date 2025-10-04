import { ExamTimeTable } from "../../../types/service.types.js";
import { BaseResourceSyncer } from "./base.js";
import { fetchTimetables } from "../../../api/services/index.js";
import { ExamTimetablesRepository } from "../../../db/repositories/ExamTimetablesRepository.js";
import { withTransaction } from "../../../db/transactions.js";
import logger from "../../../utils/logger.js";

export class ExamTimetablesSyncer extends BaseResourceSyncer {
  readonly name = "exam_timetables";

  private readonly PAGE_SIZE = 100;
  private readonly BATCH_SIZE = 20;

  private async fetchPage(pageNumber: number): Promise<ExamTimeTable[]> {
    logger.debug(
      `[${this.name}] Fetching page ${pageNumber} (size: ${this.PAGE_SIZE})`
    );
    return await fetchTimetables({
      pageNumber,
      dataSize: this.PAGE_SIZE,
    });
  }

  private async *fetchTimetablesInBatches(): AsyncGenerator<
    ExamTimeTable[],
    void,
    unknown
  > {
    let pageNumber = 0;
    let hasMorePages = true;

    while (hasMorePages) {
      const batch: ExamTimeTable[] = [];

      // Fetch BATCH_SIZE pages at once
      for (let i = 0; i < this.BATCH_SIZE && hasMorePages; i++) {
        const timetables = await this.fetchPage(pageNumber);

        // If we get fewer items than PAGE_SIZE, we've reached the end
        if (timetables.length === 0) {
          hasMorePages = false;
          break;
        }

        batch.push(...timetables);
        pageNumber++;

        // If we got less than a full page, we're at the end
        if (timetables.length < this.PAGE_SIZE) {
          hasMorePages = false;
          break;
        }
      }

      // Yield the batch if we collected any timetables
      if (batch.length > 0) {
        logger.debug(
          `[${this.name}] Yielding batch with ${batch.length} timetables`
        );
        yield batch;
      }
    }

    logger.debug(`[${this.name}] Finished fetching all timetables`);
  }

  async needsInitialSync(): Promise<boolean> {
    // Check if exam timetables search table is empty
    const repo = new ExamTimetablesRepository();
    const count = await repo.getCount();

    logger.debug(`[${this.name}] Current timetables count in DB: ${count}`);

    // If no timetables exist, we need initial sync
    return count === 0;
  }

  async performInitialSync(): Promise<void> {
    logger.info(`[${this.name}] Starting initial sync...`);

    let totalProcessed = 0;
    let batchNumber = 0;

    await withTransaction(async tx => {
      const repo = new ExamTimetablesRepository(tx);

      for await (const batch of this.fetchTimetablesInBatches()) {
        batchNumber++;
        logger.info(
          `[${this.name}] Processing batch ${batchNumber} with ${batch.length} timetables`
        );

        const transformedBatch = batch.map(timetable =>
          ExamTimetablesRepository.transformFromApi(timetable)
        );
        const upserted = await repo.bulkUpsert(transformedBatch);

        logger.debug(
          `[${this.name}] Batch ${batchNumber}: upserted ${upserted.length} timetables`
        );

        totalProcessed += batch.length;
        logger.info(
          `[${this.name}] Processed ${totalProcessed} timetables so far`
        );
      }
    });

    logger.info(
      `[${this.name}] Initial sync completed. Total timetables processed: ${totalProcessed}`
    );
  }

  async performPeriodicSync(): Promise<void> {
    logger.debug(`[${this.name}] Starting periodic sync`);

    try {
      // Fetch recent timetables (first 2 pages to catch any recent updates)
      const recentBatch1 = await this.fetchPage(0);
      const recentBatch2 = await this.fetchPage(1);
      const recentTimetables = [...recentBatch1, ...recentBatch2];

      if (recentTimetables.length === 0) {
        logger.debug(`[${this.name}] No recent timetables found`);
        return;
      }

      // Transform and upsert in transaction
      await withTransaction(async tx => {
        const repo = new ExamTimetablesRepository(tx);
        const transformedTimetables = recentTimetables.map(timetable =>
          ExamTimetablesRepository.transformFromApi(timetable)
        );
        const upserted = await repo.bulkUpsert(transformedTimetables);

        logger.debug(
          `[${this.name}] Periodic sync: Processed ${upserted.length} timetables`
        );
      });

      logger.debug(
        `[${this.name}] Periodic sync completed. Processed ${recentTimetables.length} timetables`
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
