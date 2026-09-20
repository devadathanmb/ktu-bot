import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { type TestContext } from "node:test";
import got from "got";
import { APICache } from "../../../src/api/cache/cache.js";
import { createCachedApiClient } from "../../../src/api/cache/create-cached-client.js";
import {
  createCacheKey,
  getTtlForUrl,
  isPathExcluded,
} from "../../../src/api/cache/keys.js";
import type { CacheConfig } from "../../../src/api/cache/types.js";

function testConfig(overrides: Partial<CacheConfig> = {}): CacheConfig {
  return {
    maxEntries: 50,
    defaultTTL: 60_000,
    endpointTTLs: {},
    excludePaths: [],
    ...overrides,
  };
}

test("cache keys are stable across body key order", () => {
  const a = createCacheKey("GET", "https://ktu/api/x", { b: 2, a: 1 });
  const b = createCacheKey("GET", "https://ktu/api/x", { a: 1, b: 2 });
  assert.equal(a, b);
});

test("cache keys differ by method, url, and body", () => {
  const base = createCacheKey("GET", "https://ktu/api/x");
  assert.notEqual(base, createCacheKey("POST", "https://ktu/api/x"));
  assert.notEqual(base, createCacheKey("GET", "https://ktu/api/y"));
  assert.notEqual(
    base,
    createCacheKey("GET", "https://ktu/api/x", { page: 1 })
  );
});

test("endpoint TTLs match by path suffix with a default fallback", () => {
  assert.equal(
    getTtlForUrl(
      "https://ktu/api/getprograms?page=1",
      { "/getprograms": 1000 },
      5000
    ),
    1000
  );
  assert.equal(
    getTtlForUrl("https://ktu/api/other", { "/getprograms": 1000 }, 5000),
    5000
  );
});

test("excluded paths match pathnames and query strings", () => {
  const excluded = ["/getAttachment", "/get?key=v3"];
  assert.equal(isPathExcluded("https://ktu/api/getAttachment", excluded), true);
  assert.equal(
    isPathExcluded("https://ktu/api/nested/getAttachment?x=1", excluded),
    true
  );
  assert.equal(isPathExcluded("https://ktu/api/get?key=v3", excluded), true);
  assert.equal(isPathExcluded("https://ktu/api/getprograms", excluded), false);
});

test("cache stores, returns, and invalidates entries", () => {
  const cache = new APICache(testConfig());
  assert.equal(cache.get("missing"), undefined);

  cache.set("k", {
    rawBody: new Uint8Array([1]),
    statusCode: 200,
    headers: {},
  });
  assert.deepEqual(cache.get("k")?.statusCode, 200);

  cache.delete("k");
  assert.equal(cache.get("k"), undefined);
});

test("cache evicts the least recently used entry", () => {
  const cache = new APICache(testConfig({ maxEntries: 2 }));
  const entry = (n: number) => ({
    rawBody: new Uint8Array([n]),
    statusCode: 200,
    headers: {},
  });

  cache.set("a", entry(1));
  cache.set("b", entry(2));
  cache.get("a");
  cache.set("c", entry(3));

  assert.ok(cache.get("a"));
  assert.equal(cache.get("b"), undefined);
  assert.ok(cache.get("c"));
});

interface TestServer {
  url: (path: string) => string;
  hits: () => number;
  setStatus: (status: number) => void;
}

async function startCountingServer(t: TestContext): Promise<TestServer> {
  let hits = 0;
  let status = 200;
  const server: Server = createServer((_req, res) => {
    hits += 1;
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, hits }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(
    async () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close(error => (error ? reject(error) : resolve()));
      })
  );
  const { port } = server.address() as AddressInfo;
  return {
    url: (path: string) => `http://127.0.0.1:${port}${path}`,
    hits: () => hits,
    setStatus: next => {
      status = next;
    },
  };
}

test("a cached GET avoids the second network call", async t => {
  const server = await startCountingServer(t);
  const client = createCachedApiClient(
    got.extend({ responseType: "json", retry: { limit: 0 } }),
    testConfig()
  );

  const first = await client.get(server.url("/getprograms")).json();
  const second = await client.get(server.url("/getprograms")).json();

  assert.deepEqual(second, first);
  assert.equal(server.hits(), 1);
});

test("excluded paths are never served from cache", async t => {
  const server = await startCountingServer(t);
  const client = createCachedApiClient(
    got.extend({ responseType: "json", retry: { limit: 0 } }),
    testConfig({ excludePaths: ["/getAttachment"] })
  );

  await client
    .get(server.url("/getAttachment"), { throwHttpErrors: false })
    .json();
  await client
    .get(server.url("/getAttachment"), { throwHttpErrors: false })
    .json();

  assert.equal(server.hits(), 2);
});

test("cache hits do not refresh the entry TTL", async t => {
  const server = await startCountingServer(t);
  const client = createCachedApiClient(
    got.extend({ responseType: "json", retry: { limit: 0 } }),
    testConfig()
  );

  const setMock = t.mock.method(APICache.prototype, "set");

  const url = server.url("/getprograms");
  await client.get(url).json();
  await client.get(url).json();
  await client.get(url).json();

  assert.equal(server.hits(), 1);
  assert.equal(setMock.mock.callCount(), 1);
});

test("a cached entry keeps serving within TTL while the origin errors", async t => {
  const server = await startCountingServer(t);
  const client = createCachedApiClient(
    got.extend({ responseType: "json", retry: { limit: 0 } }),
    testConfig()
  );
  const url = server.url("/timetable");

  await client.get(url).json();
  assert.equal(server.hits(), 1);

  // Cache-first design: the synthetic 200 short-circuits before the
  // network, so an origin 500 is masked until the entry expires.
  server.setStatus(500);
  const stale = await client.get(url, { throwHttpErrors: false }).json();
  assert.deepEqual(stale, { ok: true, hits: 1 });
  assert.equal(server.hits(), 1);
});

test("a non-200 on an uncached key does not poison the cache", async t => {
  const server = await startCountingServer(t);
  const client = createCachedApiClient(
    got.extend({ responseType: "json", retry: { limit: 0 } }),
    testConfig()
  );
  const url = server.url("/fresh");

  server.setStatus(500);
  await client.get(url, { throwHttpErrors: false });
  assert.equal(server.hits(), 1);

  server.setStatus(200);
  await client.get(url).json();
  assert.equal(server.hits(), 2);

  await client.get(url).json();
  assert.equal(server.hits(), 2);
});
