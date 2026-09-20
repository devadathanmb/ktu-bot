import assert from "node:assert/strict";
import test, { after } from "node:test";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../src/db/schema/index.js";
import type { ResourceSyncer } from "../src/workers/data-sync/syncers/base.js";
import {
  dataSyncQueue,
  type SyncJobType,
} from "../src/workers/data-sync/queue.js";
import {
  DataSyncProcessor,
  type InitialSyncJob,
} from "../src/workers/data-sync/worker.js";

const SYNC_TYPES: SyncJobType[] = [
  "data-sync:announcements",
  "data-sync:academic-calendars",
  "data-sync:exam-timetables",
];

// The imported worker module constructs the real queue, whose Redis
// connection would keep the test process alive. It is never used here:
// scheduling goes through the injected enqueueSyncJob seam.
after(async () => {
  await dataSyncQueue.close();
});

function fakeSyncer(name: string, needs: boolean | Error): ResourceSyncer {
  return {
    name,
    needsInitialSync: async () => {
      if (needs instanceof Error) throw needs;
      return needs;
    },
    performInitialSync: async () => {},
    performPeriodicSync: async () => {},
  };
}

function createProcessor(needs: Record<SyncJobType, boolean | Error>): {
  processor: DataSyncProcessor;
  enqueued: InitialSyncJob[];
} {
  const enqueued: InitialSyncJob[] = [];
  const processor = new DataSyncProcessor(
    null as unknown as NodePgDatabase<typeof schema>,
    {
      syncers: {
        "data-sync:announcements": fakeSyncer(
          "announcements",
          needs["data-sync:announcements"]
        ),
        "data-sync:academic-calendars": fakeSyncer(
          "academic-calendars",
          needs["data-sync:academic-calendars"]
        ),
        "data-sync:exam-timetables": fakeSyncer(
          "exam-timetables",
          needs["data-sync:exam-timetables"]
        ),
      },
      enqueueSyncJob: async job => {
        enqueued.push(job);
      },
    }
  );
  return { processor, enqueued };
}

function noSyncNeeded(): Record<SyncJobType, boolean | Error> {
  return {
    "data-sync:announcements": false,
    "data-sync:academic-calendars": false,
    "data-sync:exam-timetables": false,
  };
}

test("no initial sync required enqueues nothing", async () => {
  const { processor, enqueued } = createProcessor(noSyncNeeded());

  await processor.scheduleInitialSync();

  assert.deepEqual(enqueued, []);
});

test("a subset requiring initial sync enqueues deterministic jobs", async () => {
  const { processor, enqueued } = createProcessor({
    ...noSyncNeeded(),
    "data-sync:announcements": true,
    "data-sync:academic-calendars": true,
  });

  await processor.scheduleInitialSync();

  assert.deepEqual(enqueued, [
    {
      name: "data-sync:announcements",
      data: { syncType: "data-sync:announcements" },
    },
    {
      name: "data-sync:academic-calendars",
      data: { syncType: "data-sync:academic-calendars" },
    },
  ]);
});

test("all resources requiring initial sync enqueues every job", async () => {
  const { processor, enqueued } = createProcessor({
    "data-sync:announcements": true,
    "data-sync:academic-calendars": true,
    "data-sync:exam-timetables": true,
  });

  await processor.scheduleInitialSync();

  assert.deepEqual(
    enqueued.map(job => job.name),
    SYNC_TYPES
  );
});

test("a rejected check propagates and enqueues nothing", async () => {
  const { processor, enqueued } = createProcessor({
    ...noSyncNeeded(),
    "data-sync:academic-calendars": new Error("db is down"),
  });

  await assert.rejects(processor.scheduleInitialSync(), /db is down/);
  assert.deepEqual(enqueued, []);
});
