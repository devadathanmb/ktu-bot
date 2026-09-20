import assert from "node:assert/strict";
import test from "node:test";
import { setupRecurringSchedules } from "../src/workers/shared/recurring-schedules.ts";

const SYNC_SCHEDULES = [
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

function createFakeQueue(schedulers = []) {
  const store = new Map(
    schedulers.map(scheduler => [scheduler.key, scheduler])
  );
  const removed = [];
  const upserted = [];

  return {
    store,
    removed,
    upserted,
    async getJobSchedulers() {
      return [...store.values()];
    },
    async removeJobScheduler(schedulerId) {
      removed.push(schedulerId);
      return store.delete(schedulerId);
    },
    async upsertJobScheduler(schedulerId, repeatOpts, jobTemplate) {
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

test("keeps one stable scheduler per job when the cron pattern changes", async () => {
  const queue = createFakeQueue();

  await setupRecurringSchedules(queue, SYNC_SCHEDULES, "*/30 * * * *");
  await setupRecurringSchedules(queue, SYNC_SCHEDULES, "0 * * * *");

  assert.deepEqual([...queue.store.keys()].sort(), [
    "recurring-sync-announcements",
    "recurring-sync-calendars",
  ]);

  for (const schedule of SYNC_SCHEDULES) {
    const stored = queue.store.get(schedule.schedulerId);
    assert.equal(stored.name, schedule.jobName);
    assert.equal(stored.pattern, "0 * * * *");
    assert.deepEqual(stored.template.data, schedule.data);
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
    queue,
    SYNC_SCHEDULES,
    "*/30 * * * *"
  );

  const expectedRemovals = [legacyAnnouncements, legacyCalendars].sort();
  assert.deepEqual(result.removedLegacySchedulerIds.sort(), expectedRemovals);
  assert.deepEqual(queue.removed.sort(), expectedRemovals);
  assert.ok(queue.store.has("unrelated-scheduler"));
  assert.equal(queue.store.get("unrelated-scheduler").pattern, "*/30 * * * *");
  assert.equal(
    queue.store.get("recurring-sync-announcements").name,
    "data-sync:announcements"
  );
  assert.deepEqual(queue.store.get("recurring-sync-calendars").template.data, {
    syncType: "data-sync:academic-calendars",
  });
});
