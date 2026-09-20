import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerShutdown } from "../../../src/workers/shared/worker-shutdown.js";

test("worker shutdown closes the worker and resolves", async () => {
  let closeCalls = 0;
  const worker = {
    getStatus: async () => true,
    close: async () => {
      closeCalls += 1;
    },
  };

  await createWorkerShutdown(worker)();

  assert.equal(closeCalls, 1);
});

test("worker shutdown propagates a close failure", async () => {
  const worker = {
    getStatus: async () => true,
    close: async () => {
      throw new Error("worker close failed");
    },
  };

  await assert.rejects(createWorkerShutdown(worker)(), /worker close failed/);
});
