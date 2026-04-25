import { ExamTimeTable } from "../../../types/service.types.js";
import { BaseResourceSyncer } from "./base.js";
import { fetchTimetables } from "../../../api/services/index.js";
import { ExamTimetablesRepository } from "../../../db/repositories/exam-timetables-repository.js";
import { withTransaction } from "../../../db/transactions.js";
import logger from "../../../utils/logger.js";

export class ExamTimetablesSyncer extends BaseResourceSyncer {
  readonly name = "exam_timetables";

  private readonly PAGE_SIZE = 100;
  private readonly BATCH_SIZE = 20;

  private async fetchPage(
    pageNumber: number,
    options?: { log?: boolean }
  ): Promise<ExamTimeTable[]> {
    if (options?.log !== false) {
      logger.debug(
        { syncer: this.name, pageNumber, pageSize: this.PAGE_SIZE },
        "Fetching page"
      );
    }
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
          { syncer: this.name, batchSize: batch.length },
          "Yielding batch"
        );
        yield batch;
      }
    }

    logger.debug({ syncer: this.name }, "Finished fetching all timetables");
  }

  async needsInitialSync(): Promise<boolean> {
    // Check if exam timetables search table is empty
    const repo = new ExamTimetablesRepository();
    const count = await repo.getCount();

    logger.debug(
      { syncer: this.name, count },
      "Current timetables count in DB"
    );

    // If no timetables exist, we need initial sync
    return count === 0;
  }

  async performInitialSync(): Promise<void> {
    logger.info({ syncer: this.name }, "Starting initial sync");

    let totalProcessed = 0;
    let batchNumber = 0;

    await withTransaction(async tx => {
      const repo = new ExamTimetablesRepository(tx);

      for await (const batch of this.fetchTimetablesInBatches()) {
        batchNumber++;
        logger.info(
          { syncer: this.name, batchNumber, batchSize: batch.length },
          "Processing batch"
        );

        const transformedBatch = batch.map(timetable =>
          ExamTimetablesRepository.transformFromApi(timetable)
        );
        const upserted = await repo.bulkUpsert(transformedBatch);

        logger.debug(
          { syncer: this.name, batchNumber, upsertedCount: upserted.length },
          "Batch upserted"
        );

        totalProcessed += batch.length;
        logger.info(
          { syncer: this.name, totalProcessed },
          "Processed timetables so far"
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

    // Fetch recent timetables (first 2 pages to catch any recent updates)
    const recentBatch1 = await this.fetchPage(0, { log: false });
    const recentBatch2 = await this.fetchPage(1, { log: false });
    const recentTimetables = [...recentBatch1, ...recentBatch2];

    if (recentTimetables.length === 0) {
      logger.info({ syncer: this.name }, "No recent timetables found");
      return;
    }

    // Transform and upsert in transaction
    await withTransaction(async tx => {
      const repo = new ExamTimetablesRepository(tx);
      const transformedTimetables = recentTimetables.map(timetable =>
        ExamTimetablesRepository.transformFromApi(timetable)
      );
      const upserted = await repo.bulkUpsert(transformedTimetables);

      logger.info(
        { syncer: this.name, processedCount: upserted.length },
        "Periodic sync processed timetables"
      );
    });

    logger.info(
      { syncer: this.name, processedCount: recentTimetables.length },
      "Periodic sync completed"
    );
  }
}
