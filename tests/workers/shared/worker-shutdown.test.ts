import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerShutdown } from "../../../src/workers/shared/worker-shutdown.js";

test("worker shutdown closes the worker before the database", async () => {
  const calls: string[] = [];
  const worker = {
    getStatus: async () => true,
    close: async () => {
      calls.push("worker");
    },
  };

  await createWorkerShutdown(worker, {
    closeDB: async () => {
      calls.push("database");
    },
  })();

  assert.deepEqual(calls, ["worker", "database"]);
});

test("worker shutdown propagates a worker close failure", async () => {
  let closeDBCalls = 0;
  const worker = {
    getStatus: async () => true,
    close: async () => {
      throw new Error("worker close failed");
    },
  };

  await assert.rejects(
    createWorkerShutdown(worker, {
      closeDB: async () => {
        closeDBCalls += 1;
      },
    })(),
    /worker close failed/
  );
  assert.equal(closeDBCalls, 0);
});

test("worker shutdown propagates a database close failure", async () => {
  const worker = {
    getStatus: async () => true,
    close: async () => {},
  };

  await assert.rejects(
    createWorkerShutdown(worker, {
      closeDB: async () => {
        throw new Error("database close failed");
      },
    })(),
    /database close failed/
  );
});
