import assert from "node:assert/strict";
import test from "node:test";
import got, { RequestError, type NormalizedOptions } from "got";
import { TokenSolverConfig } from "../../src/configs/token-solver.js";
import {
  createFetchToken,
  TokenSolverError,
} from "../../src/api/token-solver.js";
import {
  addXTokenHeader,
  createAddXTokenHeader,
} from "../../src/api/hooks/before/add-x-token-header.js";
import { addKtuHeaders } from "../../src/api/hooks/before/add-ktu-headers.js";
import { baseApiClient, cachedApiClient } from "../../src/api/client.js";

const tokenUrl = `${TokenSolverConfig.URL}/token`;
const ktuUrl = "https://api.ktu.edu.in/ktu-web-portal-api/anon/announcemnts";

type FetchArgs = Parameters<typeof fetch>;

function createFetchStub(respond: (...args: FetchArgs) => Promise<Response>): {
  fetchImpl: typeof fetch;
  calls: FetchArgs[];
} {
  const calls: FetchArgs[] = [];
  const fetchImpl = async (...args: FetchArgs): Promise<Response> => {
    calls.push(args);
    return respond(...args);
  };
  return { fetchImpl, calls };
}

test("fetchToken returns the solver token and calls it once", async () => {
  const { fetchImpl, calls } = createFetchStub(async () =>
    Response.json({ token: "turnstile-token" })
  );
  const fetchToken = createFetchToken(fetchImpl);

  assert.equal(await fetchToken(), "turnstile-token");
  assert.equal(calls.length, 1);
  const firstCall = calls[0];
  assert.ok(firstCall);
  assert.equal(firstCall[0], tokenUrl);
  assert.ok(firstCall[1]?.signal instanceof AbortSignal);
});

test("fetchToken rejects on a non-2xx solver response", async () => {
  const { fetchImpl } = createFetchStub(
    async () => new Response("{}", { status: 503 })
  );
  const fetchToken = createFetchToken(fetchImpl);

  await assert.rejects(fetchToken(), /status 503/);
});

test("fetchToken rejects on malformed solver JSON", async () => {
  const { fetchImpl } = createFetchStub(
    async () => new Response("<html>not json</html>")
  );
  const fetchToken = createFetchToken(fetchImpl);

  await assert.rejects(fetchToken(), /malformed JSON/);
});

test("fetchToken failures are TokenSolverErrors", async () => {
  const { fetchImpl } = createFetchStub(
    async () => new Response("{}", { status: 503 })
  );

  const fetchToken = createFetchToken(fetchImpl);
  const error = await fetchToken().catch((caught: unknown) => caught);
  assert.ok(error instanceof TokenSolverError);
});

test("fetchToken rejects on an absent or blank token", async () => {
  for (const body of [{}, { token: "" }, { token: "   " }, "token"]) {
    const { fetchImpl } = createFetchStub(async () => Response.json(body));
    const fetchToken = createFetchToken(fetchImpl);
    await assert.rejects(fetchToken(), /blank token/);
  }
});

test("fetchToken propagates solver network and timeout failures", async () => {
  const cases: Array<[unknown, RegExp]> = [
    [new Error("connect ECONNREFUSED 172.17.0.1:5001"), /ECONNREFUSED/],
    [
      new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError"
      ),
      /aborted due to timeout/,
    ],
  ];
  for (const [error, pattern] of cases) {
    const { fetchImpl } = createFetchStub(async () => {
      throw error;
    });
    const fetchToken = createFetchToken(fetchImpl);
    await assert.rejects(fetchToken(), pattern);
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
    const headers: Record<string, string | undefined> = { accept: "*/*" };
    const options = {
      url: url === undefined ? undefined : new URL(url),
      headers,
    };
    await hook(options as unknown as NormalizedOptions, { retryCount: 0 });

    assert.equal(mintCalls, 0);
    assert.deepEqual(headers, { accept: "*/*" });
  }
});

test("token hook attaches one fresh token per KTU request", async () => {
  let mintCalls = 0;
  const hook = createAddXTokenHeader(async () => {
    mintCalls += 1;
    return `fresh-token-${mintCalls}`;
  });

  const headers: Record<string, string | undefined> = {
    "Content-Type": "application/json",
  };
  const options = { url: new URL(ktuUrl), headers };
  await hook(options as unknown as NormalizedOptions, { retryCount: 0 });

  assert.equal(mintCalls, 1);
  assert.equal(options.headers["X-Token"], "fresh-token-1");
  assert.equal(options.headers["Content-Type"], "application/json");
});

test("token hook fails the request when minting fails", async () => {
  const hook = createAddXTokenHeader(async () => {
    throw new Error("Token solver responded with status 500");
  });

  const headers: Record<string, string | undefined> = {};
  const options = { url: new URL(ktuUrl), headers };
  await assert.rejects(async () => {
    await hook(options as unknown as NormalizedOptions, { retryCount: 0 });
  }, /status 500/);
  assert.equal("X-Token" in headers, false);
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
    (error: unknown) =>
      error instanceof RequestError && /status 500/.test(error.message)
  );
  assert.equal(mintCalls, 1);
});
