import assert from "node:assert/strict";
import test from "node:test";
import {
  enqueueWithReconcile,
  withDeadline,
  type DeliveryQueuePort,
} from "../../../src/workers/attachment-delivery/enqueue.js";
import type { AttachmentDeliveryJob } from "../../../src/workers/attachment-delivery/queue.js";

type AddOutcome = { type: "ok"; id: string } | { type: "throw"; error: Error };
type GetOutcome = { id: string } | undefined | Error;

function jobData(): AttachmentDeliveryJob {
  return {
    chatId: 7,
    requestedByUserId: 11,
    attachments: [{ name: "a.pdf", encryptId: "enc-a" }],
    statusMessageId: 40,
    context: "calendar",
  };
}

function stubPort(script: {
  adds: AddOutcome[];
  gets: GetOutcome[];
  getDelayMs?: number;
}): { port: DeliveryQueuePort; calls: string[] } {
  let addIndex = 0;
  let getIndex = 0;
  const calls: string[] = [];
  return {
    calls,
    port: {
      add: async (_name, _data, opts) => {
        calls.push(`add:${opts.jobId}`);
        const outcome = script.adds[addIndex++];
        if (!outcome || outcome.type === "throw") {
          throw (
            (outcome as { error?: Error } | undefined)?.error ??
            new Error("add failed")
          );
        }
        return { id: outcome.id };
      },
      getJob: async id => {
        calls.push(`getJob:${id}`);
        if (script.getDelayMs !== undefined) {
          await new Promise(resolve => setTimeout(resolve, script.getDelayMs));
        }
        const outcome = script.gets[getIndex++];
        if (outcome instanceof Error) throw outcome;
        return outcome;
      },
    },
  };
}

const timeoutError = () => new Error("Command timed out");
const JOB_ID = "job-id-1";

test("first add success returns without reconciliation", async () => {
  const { port, calls } = stubPort({
    adds: [{ type: "ok", id: "fresh" }],
    gets: [],
  });
  const job = await enqueueWithReconcile(port, jobData(), JOB_ID);
  assert.equal(job.id, "fresh");
  assert.deepEqual(calls, [`add:${JOB_ID}`]);
});

test("timed-out add reconciles to the landed job", async () => {
  const { port, calls } = stubPort({
    adds: [{ type: "throw", error: timeoutError() }],
    gets: [{ id: "landed" }],
  });
  const job = await enqueueWithReconcile(port, jobData(), JOB_ID);
  assert.equal(job.id, "landed");
  assert.deepEqual(calls, [`add:${JOB_ID}`, `getJob:${JOB_ID}`]);
});

test("missing job is re-added under the same id", async () => {
  const { port, calls } = stubPort({
    adds: [
      { type: "throw", error: timeoutError() },
      { type: "ok", id: "retry" },
    ],
    gets: [undefined],
  });
  const job = await enqueueWithReconcile(port, jobData(), JOB_ID);
  assert.equal(job.id, "retry");
  assert.deepEqual(calls, [
    `add:${JOB_ID}`,
    `getJob:${JOB_ID}`,
    `add:${JOB_ID}`,
  ]);
});

test("late-landing job is found after the retry also fails", async () => {
  const { port, calls } = stubPort({
    adds: [
      { type: "throw", error: timeoutError() },
      { type: "throw", error: timeoutError() },
    ],
    gets: [undefined, { id: "late" }],
  });
  const job = await enqueueWithReconcile(port, jobData(), JOB_ID);
  assert.equal(job.id, "late");
  assert.deepEqual(calls, [
    `add:${JOB_ID}`,
    `getJob:${JOB_ID}`,
    `add:${JOB_ID}`,
    `getJob:${JOB_ID}`,
  ]);
});

test("total failure throws the retry error", async () => {
  const retryError = new Error("Connection is closed");
  const { port, calls } = stubPort({
    adds: [
      { type: "throw", error: timeoutError() },
      { type: "throw", error: retryError },
    ],
    gets: [undefined, undefined],
  });
  await assert.rejects(
    enqueueWithReconcile(port, jobData(), JOB_ID),
    (error: unknown) => {
      assert.equal(error, retryError);
      return true;
    }
  );
  assert.deepEqual(calls, [
    `add:${JOB_ID}`,
    `getJob:${JOB_ID}`,
    `add:${JOB_ID}`,
    `getJob:${JOB_ID}`,
  ]);
});

test("failing lookups are treated as misses", async () => {
  const { port, calls } = stubPort({
    adds: [
      { type: "throw", error: timeoutError() },
      { type: "ok", id: "retry" },
    ],
    gets: [new Error("Connection is closed")],
  });
  const job = await enqueueWithReconcile(port, jobData(), JOB_ID);
  assert.equal(job.id, "retry");
  assert.deepEqual(calls, [
    `add:${JOB_ID}`,
    `getJob:${JOB_ID}`,
    `add:${JOB_ID}`,
  ]);
});

test("no new write starts after the deadline", async () => {
  const firstError = timeoutError();
  const { port, calls } = stubPort({
    adds: [{ type: "throw", error: firstError }],
    gets: [undefined],
  });
  await assert.rejects(
    enqueueWithReconcile(port, jobData(), JOB_ID, performance.now() - 1),
    (error: unknown) => {
      assert.equal(error, firstError);
      return true;
    }
  );
  assert.deepEqual(calls, [`add:${JOB_ID}`, `getJob:${JOB_ID}`]);
});

test("no new write starts when the deadline crosses mid-lookup", async () => {
  const firstError = timeoutError();
  const { port, calls } = stubPort({
    adds: [{ type: "throw", error: firstError }],
    gets: [undefined],
    getDelayMs: 30,
  });
  await assert.rejects(
    enqueueWithReconcile(port, jobData(), JOB_ID, performance.now() + 10),
    (error: unknown) => {
      assert.equal(error, firstError);
      return true;
    }
  );
  assert.deepEqual(calls, [`add:${JOB_ID}`, `getJob:${JOB_ID}`]);
});

test("withDeadline passes through fast work", async () => {
  const job = await withDeadline(Promise.resolve({ id: "fast" }), 1000, "late");
  assert.deepEqual(job, { id: "fast" });
});

test("withDeadline rejects when work stalls past the budget", async () => {
  await assert.rejects(
    withDeadline(new Promise(() => {}), 20, "budget exceeded"),
    /budget exceeded/
  );
});
