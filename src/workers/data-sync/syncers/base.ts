import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../../db/schema/index.js";
import type { Got } from "got";
import { withTransaction } from "../../../db/transactions.js";
import type { DatabaseInstance } from "../../../db/types.js";
import logger from "../../../utils/logger.js";

export interface ResourceSyncer {
  readonly name: string;
  needsInitialSync(): Promise<boolean>;
  performInitialSync(): Promise<void>;
  performPeriodicSync(): Promise<void>;
}

interface RepoBase<TInsert> {
  getCount(): Promise<number>;
  bulkUpsert(items: TInsert[]): Promise<number>;
}

export abstract class BaseResourceSyncer<
  TEntity,
  TInsert,
> implements ResourceSyncer {
  protected db: NodePgDatabase<typeof schema>;
  protected apiClient: Got;

  constructor(database: NodePgDatabase<typeof schema>, apiClient: Got) {
    this.db = database;
    this.apiClient = apiClient;
  }

  abstract readonly name: string;
  protected abstract readonly pageSize: number;
  protected abstract readonly batchSize: number;

  protected abstract fetchPage(pageNumber: number): Promise<TEntity[]>;

  protected abstract transformFromApi(item: TEntity): TInsert;

  protected abstract createRepo(
    dbInstance: DatabaseInstance
  ): RepoBase<TInsert>;

  protected async *fetchInBatches(): AsyncGenerator<TEntity[], void, unknown> {
    let pageNumber = 0;
    let hasMorePages = true;

    while (hasMorePages) {
      const batch: TEntity[] = [];

      for (let i = 0; i < this.batchSize && hasMorePages; i++) {
        const items = await this.fetchPage(pageNumber);

        if (items.length === 0) {
          hasMorePages = false;
          break;
        }

        batch.push(...items);
        pageNumber++;

        if (items.length < this.pageSize) {
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

    logger.debug({ syncer: this.name }, "Finished fetching all");
  }

  async needsInitialSync(): Promise<boolean> {
    const repo = this.createRepo(this.db);
    const count = await repo.getCount();

    logger.debug({ syncer: this.name, count }, "Current count in DB");

    return count === 0;
  }

  async performInitialSync(): Promise<void> {
    logger.info({ syncer: this.name }, "Starting initial sync");

    let totalProcessed = 0;
    let batchNumber = 0;

    await withTransaction(async tx => {
      const repo = this.createRepo(tx);

      for await (const batch of this.fetchInBatches()) {
        batchNumber++;
        logger.info(
          { syncer: this.name, batchNumber, batchSize: batch.length },
          "Processing batch"
        );

        const transformedBatch = batch.map(item => this.transformFromApi(item));
        const upserted = await repo.bulkUpsert(transformedBatch);

        logger.debug(
          { syncer: this.name, batchNumber, upsertedCount: upserted },
          "Batch upserted"
        );

        totalProcessed += batch.length;
        logger.info({ syncer: this.name, totalProcessed }, "Processed so far");
      }
    });

    logger.info(
      { syncer: this.name, totalProcessed },
      "Initial sync completed"
    );
  }

  async performPeriodicSync(): Promise<void> {
    logger.info({ syncer: this.name }, "Starting periodic sync");

    const recentBatch1 = await this.fetchPage(0);
    const recentBatch2 = await this.fetchPage(1);
    const recentItems = [...recentBatch1, ...recentBatch2];

    if (recentItems.length === 0) {
      logger.info({ syncer: this.name }, "No recent items found");
      return;
    }

    await withTransaction(async tx => {
      const repo = this.createRepo(tx);
      const transformedItems = recentItems.map(item =>
        this.transformFromApi(item)
      );
      const upserted = await repo.bulkUpsert(transformedItems);

      logger.info(
        { syncer: this.name, processedCount: upserted },
        "Periodic sync completed"
      );
    });

    logger.info(
      { syncer: this.name, processedCount: recentItems.length },
      "Periodic sync completed"
    );
  }
}
