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

test("worker shutdown stops monitoring before the worker and database", async () => {
  const calls: string[] = [];
  const worker = {
    getStatus: async () => true,
    close: async () => {
      calls.push("worker");
    },
  };

  await createWorkerShutdown(worker, {
    closeMonitoringServer: async () => {
      calls.push("monitoring");
    },
    closeDB: async () => {
      calls.push("database");
    },
  })();

  assert.deepEqual(calls, ["monitoring", "worker", "database"]);
});

test("worker shutdown attempts every close when the worker close fails", async () => {
  let closeDBCalls = 0;
  let monitoringCloseCalls = 0;
  const worker = {
    getStatus: async () => true,
    close: async () => {
      throw new Error("worker close failed");
    },
  };

  await assert.rejects(
    createWorkerShutdown(worker, {
      closeMonitoringServer: async () => {
        monitoringCloseCalls += 1;
      },
      closeDB: async () => {
        closeDBCalls += 1;
      },
    })(),
    /worker close failed/
  );
  assert.equal(monitoringCloseCalls, 1);
  assert.equal(closeDBCalls, 1);
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

test("worker shutdown aggregates failures from several closes", async () => {
  const monitoringError = new Error("monitoring close failed");
  const workerError = new Error("worker close failed");
  const databaseError = new Error("database close failed");
  let closeDBCalls = 0;
  const worker = {
    getStatus: async () => true,
    close: async () => {
      throw workerError;
    },
  };

  const failure: unknown = await createWorkerShutdown(worker, {
    closeMonitoringServer: async () => {
      throw monitoringError;
    },
    closeDB: async () => {
      closeDBCalls += 1;
      throw databaseError;
    },
  })().then(
    () => undefined,
    (error: unknown) => error
  );

  assert.ok(failure instanceof AggregateError);
  assert.deepEqual(failure.errors, [
    monitoringError,
    workerError,
    databaseError,
  ]);
  assert.equal(closeDBCalls, 1);
});
