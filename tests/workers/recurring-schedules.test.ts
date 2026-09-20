import assert from "node:assert/strict";
import test from "node:test";
import {
  setupRecurringSchedules,
  type RecurringJobSchedule,
  type SchedulerQueue,
} from "../../src/workers/shared/recurring-schedules.js";

interface SyncData {
  syncType: string;
}

const SYNC_SCHEDULES: Array<RecurringJobSchedule<SyncData>> = [
  {
    schedulerId: "recurring-sync-announcements",
    jobName: "data-sync:announcements",
    data: { syncType: "data-sync:announcements" },
  },
  {
    schedulerId: "recurring-sync-calendars",
    jobName: "data-sync:academic-calendars",
    data: { syncType: "data-sync:academic-calendars" },
  },
];

interface FakeSchedulerEntry {
  key: string;
  name: string;
  pattern?: string;
  template?: { data: SyncData };
}

// Minimal double for the BullMQ queue surface that setupRecurringSchedules
// touches. The cast at the call site keeps the fake small instead of
// implementing the full Queue class.
function createFakeQueue(schedulers: FakeSchedulerEntry[] = []) {
  const store = new Map<string, FakeSchedulerEntry>(
    schedulers.map(scheduler => [scheduler.key, scheduler])
  );
  const removed: string[] = [];
  const upserted: Array<{
    schedulerId: string;
    repeatOpts: { pattern: string };
    jobTemplate: { name: string; data: SyncData };
  }> = [];

  return {
    store,
    removed,
    upserted,
    async getJobSchedulers(): Promise<FakeSchedulerEntry[]> {
      return [...store.values()];
    },
    async removeJobScheduler(schedulerId: string): Promise<boolean> {
      removed.push(schedulerId);
      return store.delete(schedulerId);
    },
    async upsertJobScheduler(
      schedulerId: string,
      repeatOpts: { pattern: string },
      jobTemplate: { name: string; data: SyncData }
    ): Promise<void> {
      upserted.push({ schedulerId, repeatOpts, jobTemplate });
      store.set(schedulerId, {
        key: schedulerId,
        name: jobTemplate.name,
        pattern: repeatOpts.pattern,
        template: { data: jobTemplate.data },
      });
    },
  };
}

function asSchedulerQueue(
  queue: ReturnType<typeof createFakeQueue>
): SchedulerQueue<SyncData> {
  return queue as unknown as SchedulerQueue<SyncData>;
}

test("keeps one stable scheduler per job when the cron pattern changes", async () => {
  const queue = createFakeQueue();

  await setupRecurringSchedules(
    asSchedulerQueue(queue),
    SYNC_SCHEDULES,
    "*/30 * * * *"
  );
  await setupRecurringSchedules(
    asSchedulerQueue(queue),
    SYNC_SCHEDULES,
    "0 * * * *"
  );

  assert.deepEqual([...queue.store.keys()].sort(), [
    "recurring-sync-announcements",
    "recurring-sync-calendars",
  ]);

  for (const schedule of SYNC_SCHEDULES) {
    const stored = queue.store.get(schedule.schedulerId);
    assert.equal(stored?.name, schedule.jobName);
    assert.equal(stored?.pattern, "0 * * * *");
    assert.deepEqual(stored?.template?.data, schedule.data);
  }

  assert.deepEqual(
    queue.upserted.map(entry => entry.schedulerId),
    [
      "recurring-sync-announcements",
      "recurring-sync-calendars",
      "recurring-sync-announcements",
      "recurring-sync-calendars",
    ]
  );
});

test("removes legacy repeat definitions for its jobs only", async () => {
  const legacyAnnouncements = "a".repeat(64);
  const legacyCalendars = "b".repeat(64);
  const queue = createFakeQueue([
    {
      key: legacyAnnouncements,
      name: "data-sync:announcements",
      pattern: "*/30 * * * *",
    },
    {
      key: legacyCalendars,
      name: "data-sync:academic-calendars",
      pattern: "*/30 * * * *",
    },
    {
      key: "recurring-sync-announcements",
      name: "data-sync:announcements",
      pattern: "*/30 * * * *",
    },
    {
      key: "unrelated-scheduler",
      name: "other-job",
      pattern: "*/30 * * * *",
    },
  ]);

  const result = await setupRecurringSchedules(
    asSchedulerQueue(queue),
    SYNC_SCHEDULES,
    "*/30 * * * *"
  );

  const expectedRemovals = [legacyAnnouncements, legacyCalendars].sort();
  assert.deepEqual(result.removedLegacySchedulerIds.sort(), expectedRemovals);
  assert.deepEqual(queue.removed.sort(), expectedRemovals);
  assert.ok(queue.store.has("unrelated-scheduler"));
  assert.equal(queue.store.get("unrelated-scheduler")?.pattern, "*/30 * * * *");
  assert.equal(
    queue.store.get("recurring-sync-announcements")?.name,
    "data-sync:announcements"
  );
  assert.deepEqual(
    queue.store.get("recurring-sync-calendars")?.template?.data,
    {
      syncType: "data-sync:academic-calendars",
    }
  );
});
