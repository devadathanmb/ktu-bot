import assert from "node:assert/strict";
import test, { after } from "node:test";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../../src/db/schema/index.js";
import type { ResourceSyncer } from "../../src/workers/data-sync/syncers/base.js";
import {
  dataSyncQueue,
  type SyncJobType,
} from "../../src/workers/data-sync/queue.js";
import {
  DataSyncProcessor,
  type InitialSyncJob,
} from "../../src/workers/data-sync/worker.js";

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

function fakeSyncer(
  name: string,
  needs: boolean | Error,
  calls: { initial: number; periodic: number } = { initial: 0, periodic: 0 }
): ResourceSyncer {
  return {
    name,
    needsInitialSync: async () => {
      if (needs instanceof Error) throw needs;
      return needs;
    },
    performInitialSync: async () => {
      calls.initial += 1;
    },
    performPeriodicSync: async () => {
      calls.periodic += 1;
    },
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

function syncJob(syncType: SyncJobType) {
  return { id: "job-1", data: { syncType } } as unknown as Parameters<
    DataSyncProcessor["process"]
  >[0];
}

test("process routes to initial sync when the store is empty", async () => {
  const calls = { initial: 0, periodic: 0 };
  const processor = new DataSyncProcessor(
    null as unknown as NodePgDatabase<typeof schema>,
    {
      syncers: {
        "data-sync:announcements": fakeSyncer("announcements", true, calls),
        "data-sync:academic-calendars": fakeSyncer("academic-calendars", false),
        "data-sync:exam-timetables": fakeSyncer("exam-timetables", false),
      },
    }
  );

  await processor.process(syncJob("data-sync:announcements"));

  assert.deepEqual(calls, { initial: 1, periodic: 0 });
});

test("process routes to periodic sync when the store is seeded", async () => {
  const calls = { initial: 0, periodic: 0 };
  const processor = new DataSyncProcessor(
    null as unknown as NodePgDatabase<typeof schema>,
    {
      syncers: {
        "data-sync:announcements": fakeSyncer("announcements", false, calls),
        "data-sync:academic-calendars": fakeSyncer("academic-calendars", false),
        "data-sync:exam-timetables": fakeSyncer("exam-timetables", false),
      },
    }
  );

  await processor.process(syncJob("data-sync:announcements"));

  assert.deepEqual(calls, { initial: 0, periodic: 1 });
});

test("process rejects unknown sync types", async () => {
  const { processor } = createProcessor(noSyncNeeded());

  await assert.rejects(
    processor.process(syncJob("data-sync:unknown" as SyncJobType)),
    /Unknown sync type/
  );
});

test("process propagates syncer failures", async () => {
  const failure = new Error("periodic sync failed");
  const processor = new DataSyncProcessor(
    null as unknown as NodePgDatabase<typeof schema>,
    {
      syncers: {
        "data-sync:announcements": {
          name: "announcements",
          needsInitialSync: async () => false,
          performInitialSync: async () => {},
          performPeriodicSync: async () => {
            throw failure;
          },
        },
        "data-sync:academic-calendars": fakeSyncer("academic-calendars", false),
        "data-sync:exam-timetables": fakeSyncer("exam-timetables", false),
      },
    }
  );

  await assert.rejects(
    processor.process(syncJob("data-sync:announcements")),
    /periodic sync failed/
  );
});
