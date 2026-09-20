import assert from "node:assert/strict";
import test from "node:test";
import logger from "../../../src/utils/logger.js";
import { createShutdownHandler } from "../../../src/workers/shared/shutdown.js";

test("shutdown handler stops the service once and exits 0", async t => {
  let stopCalls = 0;
  const exitCodes: number[] = [];
  const infoLog = t.mock.method(logger, "info", () => {});

  const onShutdown = createShutdownHandler({
    stop: async () => {
      stopCalls += 1;
    },
    exit: code => {
      exitCodes.push(code);
    },
  });

  await onShutdown("SIGTERM");

  assert.equal(stopCalls, 1);
  assert.deepEqual(exitCodes, [0]);
  assert.deepEqual(infoLog.mock.calls[0]!.arguments, [
    { signal: "SIGTERM" },
    "Shutting down",
  ]);
});

test("shutdown handler ignores signals while shutdown is in progress", async t => {
  t.mock.method(logger, "info", () => {});

  let stopCalls = 0;
  let releaseStop: () => void = () => {};
  const stopGate = new Promise<void>(resolve => {
    releaseStop = resolve;
  });
  const exitCodes: number[] = [];

  const onShutdown = createShutdownHandler({
    stop: async () => {
      stopCalls += 1;
      await stopGate;
    },
    exit: code => {
      exitCodes.push(code);
    },
  });

  const firstShutdown = onShutdown("SIGTERM");
  const secondShutdown = onShutdown("SIGINT");
  releaseStop();
  await Promise.all([firstShutdown, secondShutdown]);

  assert.equal(stopCalls, 1);
  assert.deepEqual(exitCodes, [0]);
});

test("shutdown handler ignores signals after shutdown completed", async t => {
  t.mock.method(logger, "info", () => {});

  let stopCalls = 0;
  const exitCodes: number[] = [];

  const onShutdown = createShutdownHandler({
    stop: async () => {
      stopCalls += 1;
    },
    exit: code => {
      exitCodes.push(code);
    },
  });

  await onShutdown("SIGTERM");
  await onShutdown("SIGINT");

  assert.equal(stopCalls, 1);
  assert.deepEqual(exitCodes, [0]);
});

test("shutdown handler logs and exits 1 when stop fails", async t => {
  const stopError = new Error("stop failed");
  const exitCodes: number[] = [];
  t.mock.method(logger, "info", () => {});
  const errorLog = t.mock.method(logger, "error", () => {});

  const onShutdown = createShutdownHandler({
    stop: async () => {
      throw stopError;
    },
    exit: code => {
      exitCodes.push(code);
    },
  });

  await onShutdown("SIGINT");

  assert.deepEqual(exitCodes, [1]);
  assert.deepEqual(errorLog.mock.calls[0]!.arguments, [
    { err: stopError, signal: "SIGINT" },
    "Shutdown failed",
  ]);
});
