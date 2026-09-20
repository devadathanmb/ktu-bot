import assert from "node:assert/strict";
import test from "node:test";
import logger from "../src/utils/logger.js";
import { createBotShutdown, type BotShutdownDeps } from "../src/lifecycle.js";

interface ShutdownHarness {
  deps: BotShutdownDeps;
  calls: string[];
  exitCodes: number[];
}

function createHarness(
  overrides: Partial<BotShutdownDeps> = {}
): ShutdownHarness {
  const calls: string[] = [];
  const exitCodes: number[] = [];
  const deps: BotShutdownDeps = {
    closeMonitoringServer: async () => {
      calls.push("monitoring");
    },
    closeRunner: async () => {
      calls.push("runner");
    },
    closeAttachmentDeliveryQueue: async () => {
      calls.push("queue");
    },
    closeDB: async () => {
      calls.push("database");
    },
    exit: code => {
      exitCodes.push(code);
    },
    ...overrides,
  };

  return { deps, calls, exitCodes };
}

test("bot shutdown closes monitoring, runner, queue and database then exits 0 on a signal", async t => {
  const infoLog = t.mock.method(logger, "info", () => {});
  const { deps, calls, exitCodes } = createHarness();

  await createBotShutdown(deps)({ type: "signal", name: "SIGTERM" });

  assert.deepEqual(calls, ["monitoring", "runner", "queue", "database"]);
  assert.deepEqual(exitCodes, [0]);
  assert.deepEqual(infoLog.mock.calls[0]!.arguments, [
    { signal: "SIGTERM" },
    "Shutting down gracefully",
  ]);
});

test("bot shutdown runs cleanup once for concurrent triggers", async t => {
  const infoLog = t.mock.method(logger, "info", () => {});
  let releaseRunner: () => void = () => {};
  const runnerGate = new Promise<void>(resolve => {
    releaseRunner = resolve;
  });
  const { deps, calls, exitCodes } = createHarness({
    closeRunner: async () => {
      calls.push("runner");
      await runnerGate;
    },
  });

  const shutdown = createBotShutdown(deps);
  const firstRun = shutdown({ type: "signal", name: "SIGTERM" });
  const secondRun = shutdown({ type: "signal", name: "SIGINT" });
  releaseRunner();
  await Promise.all([firstRun, secondRun]);

  assert.deepEqual(calls, ["monitoring", "runner", "queue", "database"]);
  assert.deepEqual(exitCodes, [0]);
  assert.equal(infoLog.mock.calls.length, 1);
});

test("bot shutdown exits 1 for a startup failure even when cleanup succeeds", async t => {
  t.mock.method(logger, "info", () => {});
  const { deps, calls, exitCodes } = createHarness();

  await createBotShutdown(deps)({ type: "failure", source: "startup" });

  assert.deepEqual(calls, ["monitoring", "runner", "queue", "database"]);
  assert.deepEqual(exitCodes, [1]);
});

test("bot shutdown exits 1 for a runner failure even when cleanup succeeds", async t => {
  t.mock.method(logger, "info", () => {});
  const { deps, calls, exitCodes } = createHarness();

  await createBotShutdown(deps)({ type: "failure", source: "runner" });

  assert.deepEqual(calls, ["monitoring", "runner", "queue", "database"]);
  assert.deepEqual(exitCodes, [1]);
});

test("bot shutdown keeps cleaning up when a step fails and exits 1", async t => {
  t.mock.method(logger, "info", () => {});
  const errorLog = t.mock.method(logger, "error", () => {});
  const runnerError = new Error("runner stop failed");
  const databaseError = new Error("database close failed");
  const { deps, calls, exitCodes } = createHarness({
    closeRunner: async () => {
      calls.push("runner");
      throw runnerError;
    },
    closeDB: async () => {
      calls.push("database");
      throw databaseError;
    },
  });

  await createBotShutdown(deps)({ type: "signal", name: "SIGINT" });

  assert.deepEqual(calls, ["monitoring", "runner", "queue", "database"]);
  assert.deepEqual(exitCodes, [1]);
  assert.deepEqual(
    errorLog.mock.calls.map(call => call.arguments),
    [
      [{ err: runnerError, resource: "bot runner" }, "Shutdown step failed"],
      [{ err: databaseError, resource: "database" }, "Shutdown step failed"],
    ]
  );
});
