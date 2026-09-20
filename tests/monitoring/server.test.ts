import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { Hono } from "hono";
import test from "node:test";
import logger from "../../src/utils/logger.js";
import { createMonitoringServer } from "../../src/monitoring/index.js";

type Serve = typeof serve;

interface FakeServeState {
  requestedPorts: number[];
  closeCalls: number;
  closeError: Error | undefined;
}

function createFakeServe(info?: AddressInfo) {
  const state: FakeServeState = {
    requestedPorts: [],
    closeCalls: 0,
    closeError: undefined,
  };

  const server = {
    close(callback?: (error?: Error) => void) {
      state.closeCalls += 1;
      callback?.(state.closeError);
      return server;
    },
  } as unknown as ServerType;

  const serveFn: Serve = (options, listener) => {
    state.requestedPorts.push(options.port ?? 0);
    if (info && listener) {
      listener(info);
    }
    return server;
  };

  return { state, serveFn };
}

test("monitoring server keeps the root redirect and logs the listening port", async t => {
  const infoLog = t.mock.method(logger, "info", () => {});
  const app = new Hono();
  const { serveFn, state } = createFakeServe({
    address: "127.0.0.1",
    family: "IPv4",
    port: 4321,
  });

  createMonitoringServer(app, { serviceName: "bot", port: 3000 }, serveFn);

  assert.deepEqual(state.requestedPorts, [3000]);
  assert.deepEqual(infoLog.mock.calls[0]!.arguments, [
    { serviceName: "bot", port: 4321 },
    "Monitoring server listening",
  ]);

  const response = await app.request("/");
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/health");
});

test("monitoring server close resolves once and is idempotent", async () => {
  const app = new Hono();
  const { serveFn, state } = createFakeServe();
  const server = createMonitoringServer(
    app,
    { serviceName: "bot", port: 3000 },
    serveFn
  );

  await server.close();
  await server.close();

  assert.equal(state.closeCalls, 1);
});

test("monitoring server close rejects with the underlying close error", async () => {
  const app = new Hono();
  const { serveFn, state } = createFakeServe();
  state.closeError = new Error("server close failed");
  const server = createMonitoringServer(
    app,
    { serviceName: "bot", port: 3000 },
    serveFn
  );

  await assert.rejects(server.close(), /server close failed/);
});
