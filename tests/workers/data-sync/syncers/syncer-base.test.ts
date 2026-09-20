import assert from "node:assert/strict";
import test from "node:test";
import type { Got } from "got";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../../../../src/db/schema/index.js";
import {
  BaseResourceSyncer,
  type TransactionRunner,
} from "../../../../src/workers/data-sync/syncers/base.js";
import type { DatabaseInstance } from "../../../../src/db/types.js";

interface Item {
  id: number;
}

interface Row {
  id: number;
}

function fakeTxRunner(calls: { count: number }): TransactionRunner {
  return async <T>(
    callback: (tx: DatabaseInstance) => Promise<T>
  ): Promise<T> => {
    calls.count += 1;
    return callback({} as DatabaseInstance);
  };
}

class TestSyncer extends BaseResourceSyncer<Item, Row> {
  readonly name = "test";
  protected readonly pageSize: number;
  protected readonly batchSize: number;
  readonly pages: Map<number, Item[]>;
  readonly upserted: Row[][] = [];
  readonly fetchedPages: number[] = [];
  count = 0;
  failOnTransformIds = new Set<number>();

  constructor(options: {
    pages: Map<number, Item[]>;
    pageSize: number;
    batchSize: number;
    count?: number;
    txCalls?: { count: number };
  }) {
    super(
      null as unknown as NodePgDatabase<typeof schema>,
      null as unknown as Got,
      fakeTxRunner(options.txCalls ?? { count: 0 })
    );
    this.pages = options.pages;
    this.pageSize = options.pageSize;
    this.batchSize = options.batchSize;
    this.count = options.count ?? 0;
  }

  protected fetchPage(pageNumber: number): Promise<Item[]> {
    this.fetchedPages.push(pageNumber);
    return Promise.resolve(this.pages.get(pageNumber) ?? []);
  }

  protected transformFromApi(item: Item): Row {
    if (this.failOnTransformIds.has(item.id)) throw new Error("bad row");
    return { id: item.id };
  }

  protected createRepo(_db: DatabaseInstance) {
    return {
      getCount: async () => this.count,
      bulkUpsert: async (items: Row[]) => {
        this.upserted.push(items);
        return items.length;
      },
    };
  }

  async batches(): Promise<Item[][]> {
    const out: Item[][] = [];
    for await (const batch of this.fetchInBatches()) out.push(batch);
    return out;
  }
}

function items(ids: number[]): Item[] {
  return ids.map(id => ({ id }));
}

test("needsInitialSync reflects an empty store", async () => {
  const empty = new TestSyncer({
    pages: new Map(),
    pageSize: 2,
    batchSize: 2,
    count: 0,
  });
  assert.equal(await empty.needsInitialSync(), true);

  const seeded = new TestSyncer({
    pages: new Map(),
    pageSize: 2,
    batchSize: 2,
    count: 5,
  });
  assert.equal(await seeded.needsInitialSync(), false);
});

test("batched fetch stops at a short page", async () => {
  const syncer = new TestSyncer({
    pages: new Map([
      [0, items([1, 2])],
      [1, items([3])],
      [2, items([4, 5])],
    ]),
    pageSize: 2,
    batchSize: 5,
  });

  assert.deepEqual(await syncer.batches(), [items([1, 2, 3])]);
  assert.deepEqual(syncer.fetchedPages, [0, 1]);
});

test("batched fetch groups full pages by batch size", async () => {
  const syncer = new TestSyncer({
    pages: new Map([
      [0, items([1, 2])],
      [1, items([3, 4])],
      [2, items([5, 6])],
      [3, []],
    ]),
    pageSize: 2,
    batchSize: 2,
  });

  assert.deepEqual(await syncer.batches(), [
    items([1, 2, 3, 4]),
    items([5, 6]),
  ]);
});

test("initial sync upserts transformed batches in one transaction", async () => {
  const txCalls = { count: 0 };
  const syncer = new TestSyncer({
    pages: new Map([
      [0, items([1, 2])],
      [1, items([3])],
    ]),
    pageSize: 2,
    batchSize: 5,
    txCalls,
  });

  await syncer.performInitialSync();

  assert.equal(txCalls.count, 1);
  assert.deepEqual(syncer.upserted, [[{ id: 1 }, { id: 2 }, { id: 3 }]]);
});

test("initial sync with no pages upserts nothing", async () => {
  const txCalls = { count: 0 };
  const syncer = new TestSyncer({
    pages: new Map(),
    pageSize: 2,
    batchSize: 2,
    txCalls,
  });

  await syncer.performInitialSync();

  assert.equal(txCalls.count, 1);
  assert.deepEqual(syncer.upserted, []);
});

test("periodic sync merges the two most recent pages", async () => {
  const txCalls = { count: 0 };
  const syncer = new TestSyncer({
    pages: new Map([
      [0, items([1, 2])],
      [1, items([3])],
      [2, items([4, 5])],
    ]),
    pageSize: 2,
    batchSize: 2,
    txCalls,
  });

  await syncer.performPeriodicSync();

  assert.equal(txCalls.count, 1);
  assert.deepEqual(syncer.fetchedPages, [0, 1]);
  assert.deepEqual(syncer.upserted, [[{ id: 1 }, { id: 2 }, { id: 3 }]]);
});

test("periodic sync with no recent items skips the transaction", async () => {
  const txCalls = { count: 0 };
  const syncer = new TestSyncer({
    pages: new Map(),
    pageSize: 2,
    batchSize: 2,
    txCalls,
  });

  await syncer.performPeriodicSync();

  assert.equal(txCalls.count, 0);
  assert.deepEqual(syncer.upserted, []);
});

test("a transform failure fails the sync", async () => {
  const syncer = new TestSyncer({
    pages: new Map([[0, items([1, 2])]]),
    pageSize: 5,
    batchSize: 5,
  });
  syncer.failOnTransformIds.add(2);

  await assert.rejects(syncer.performInitialSync(), /bad row/);
});
