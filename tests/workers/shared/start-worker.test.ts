import assert from "node:assert/strict";
import test from "node:test";
import type { Queue } from "bullmq";
import logger from "../../../src/utils/logger.js";
import { startWorkerMonitoringWithDeps } from "../../../src/workers/shared/start-worker.js";
import type { MonitoringServer } from "../../../src/monitoring/index.js";

test("worker monitoring shutdown closes monitoring, worker and database", async t => {
  t.mock.method(logger, "info", () => {});

  const calls: string[] = [];
  const worker = {
    getStatus: async () => true,
    close: async () => {
      calls.push("worker");
    },
  };
  const queue = { name: "lifecycle-test-queue" } as unknown as Queue<unknown>;
  const monitoringOptions: Array<{ serviceName: string; port: number }> = [];
  let stop: (() => Promise<void>) | undefined;

  startWorkerMonitoringWithDeps(
    {
      worker,
      queue,
      serviceName: "lifecycle-test-worker",
      port: 1234,
      closeDB: async () => {
        calls.push("database");
      },
    },
    {
      createMonitoringServer: (_app, options) => {
        monitoringOptions.push(options);
        const server: MonitoringServer = {
          close: async () => {
            calls.push("monitoring");
          },
        };
        return server;
      },
      setupGracefulShutdown: handler => {
        stop = handler;
      },
    }
  );

  assert.deepEqual(monitoringOptions, [
    { serviceName: "lifecycle-test-worker", port: 1234 },
  ]);
  assert.ok(stop);
  await stop();

  assert.deepEqual(calls, ["monitoring", "worker", "database"]);
});
