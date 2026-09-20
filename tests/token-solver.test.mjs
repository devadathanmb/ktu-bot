import assert from "node:assert/strict";
import test from "node:test";
import got, { RequestError } from "got";
import { TokenSolverConfig } from "../src/configs/token-solver.ts";
import { fetchToken } from "../src/api/token-solver.ts";
import {
  addXTokenHeader,
  createAddXTokenHeader,
} from "../src/api/hooks/before/add-x-token-header.ts";
import { addKtuHeaders } from "../src/api/hooks/before/add-ktu-headers.ts";
import { baseApiClient, cachedApiClient } from "../src/api/client.ts";

const tokenUrl = `${TokenSolverConfig.URL}/token`;
const ktuUrl = "https://api.ktu.edu.in/ktu-web-portal-api/anon/announcemnts";

function solverResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function createFetchStub(respond) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return respond(url, init);
  };
  return { fetchImpl, calls };
}

test("fetchToken returns the solver token and calls it once", async () => {
  const { fetchImpl, calls } = createFetchStub(async () =>
    solverResponse({ token: "turnstile-token" })
  );

  assert.equal(await fetchToken(fetchImpl), "turnstile-token");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, tokenUrl);
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});

test("fetchToken rejects on a non-2xx solver response", async () => {
  const { fetchImpl } = createFetchStub(async () => solverResponse({}, 503));

  await assert.rejects(fetchToken(fetchImpl), /status 503/);
});

test("fetchToken rejects on malformed solver JSON", async () => {
  const { fetchImpl } = createFetchStub(async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError("Unexpected token < in JSON");
    },
  }));

  await assert.rejects(fetchToken(fetchImpl), /malformed JSON/);
});

test("fetchToken rejects on an absent or blank token", async () => {
  for (const body of [{}, { token: "" }, { token: "   " }, "token"]) {
    const { fetchImpl } = createFetchStub(async () => solverResponse(body));
    await assert.rejects(fetchToken(fetchImpl), /blank token/);
  }
});

test("fetchToken propagates solver network and timeout failures", async () => {
  for (const [error, pattern] of [
    [new Error("connect ECONNREFUSED 172.17.0.1:5001"), /ECONNREFUSED/],
    [
      new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError"
      ),
      /aborted due to timeout/,
    ],
  ]) {
    const { fetchImpl } = createFetchStub(async () => {
      throw error;
    });
    await assert.rejects(fetchToken(fetchImpl), pattern);
  }
});

test("token hook ignores non-KTU requests", async () => {
  let mintCalls = 0;
  const hook = createAddXTokenHeader(async () => {
    mintCalls += 1;
    return "fresh-token";
  });

  for (const url of [
    "https://uptime.betterstack.com/api/v2/monitors",
    undefined,
  ]) {
    const options = { url: url && new URL(url), headers: { accept: "*/*" } };
    await hook(options, { retryCount: 0 });

    assert.equal(mintCalls, 0);
    assert.deepEqual(options.headers, { accept: "*/*" });
  }
});

test("token hook attaches one fresh token per KTU request", async () => {
  let mintCalls = 0;
  const hook = createAddXTokenHeader(async () => {
    mintCalls += 1;
    return `fresh-token-${mintCalls}`;
  });

  const options = {
    url: new URL(ktuUrl),
    headers: { "Content-Type": "application/json" },
  };
  await hook(options, { retryCount: 0 });

  assert.equal(mintCalls, 1);
  assert.equal(options.headers["X-Token"], "fresh-token-1");
  assert.equal(options.headers["Content-Type"], "application/json");
});

test("token hook fails the request when minting fails", async () => {
  const hook = createAddXTokenHeader(async () => {
    throw new Error("Token solver responded with status 500");
  });

  const options = { url: new URL(ktuUrl), headers: {} };
  await assert.rejects(hook(options, { retryCount: 0 }), /status 500/);
  assert.equal("X-Token" in options.headers, false);
});

test("token hook runs after the cache hook so cache hits skip minting", () => {
  const cachedHooks = cachedApiClient.defaults.options.hooks.beforeRequest;
  // addKtuHeaders, cache lookup hook, token hook — in that order.
  assert.equal(cachedHooks.length, 3);
  assert.equal(cachedHooks[0], addKtuHeaders);
  assert.equal(cachedHooks.at(-1), addXTokenHeader);

  const baseHooks = baseApiClient.defaults.options.hooks.beforeRequest;
  assert.equal(baseHooks.length, 2);
  assert.equal(baseHooks.at(-1), addXTokenHeader);
});

test("a failing token hook rejects the KTU request before it is sent", async () => {
  let mintCalls = 0;
  const client = got.extend({
    hooks: {
      beforeRequest: [
        createAddXTokenHeader(async () => {
          mintCalls += 1;
          throw new Error("Token solver responded with status 500");
        }),
      ],
    },
  });

  // The unresolvable host would fail the test loudly if the hook ever let the
  // request through instead of failing it.
  await assert.rejects(
    client.get("https://api.ktu.edu.in.invalid/ktu-web-portal-api/anon/x"),
    error => error instanceof RequestError && /status 500/.test(error.message)
  );
  assert.equal(mintCalls, 1);
});
