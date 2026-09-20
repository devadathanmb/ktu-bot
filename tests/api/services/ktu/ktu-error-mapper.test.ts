import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { type TestContext } from "node:test";
import got, { HTTPError, RequestError } from "got";
import { z, ZodError } from "zod";
import { withKtuErrorMapper } from "../../../../src/api/services/ktu/ktu-error-mapper.js";
import { TokenSolverError } from "../../../../src/api/token-solver.js";
import { KTUAPIError } from "../../../../src/errors/bot-errors.js";
import { uploadTempFile } from "../../../../src/api/services/file/index.js";

async function startStatusServer(
  status: number,
  t: TestContext
): Promise<string> {
  const server: Server = createServer((_req, res) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end("{}");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(closeServer(server));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/ktu`;
}

function closeServer(server: Server): () => Promise<void> {
  return async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
  };
}

for (const [status, userMessage] of [
  [429, "KTU API is busy. Please try again after sometime."],
  [403, "Access denied to KTU API. Please try again later."],
  [500, "KTU API is currently unavailable. Please try again later."],
  [404, "Requested data not found. Please try again."],
  [418, "KTU API is currently having issues. Please try again later."],
] as const) {
  test(`HTTP ${status} maps to KTUAPIError with a safe message`, async t => {
    const url = await startStatusServer(status, t);
    const fetchIt = withKtuErrorMapper("fetchPrograms", async () =>
      got.get(url, { retry: { limit: 0 } }).json()
    );

    const error = await fetchIt().catch((caught: unknown) => caught);
    assert.ok(error instanceof KTUAPIError);
    assert.equal(error.serviceName, "fetchPrograms");
    assert.equal(error.userMessage, userMessage);
    assert.equal(error.statusCode, status);
    assert.ok(error.url?.startsWith("http://127.0.0.1:"));
    assert.ok(error.cause instanceof HTTPError);
  });
}

test("request failures map to KTUAPIError without a status code", async () => {
  const fetchIt = withKtuErrorMapper("fetchPrograms", async () =>
    got.get("http://127.0.0.1:1/ktu", { signal: AbortSignal.abort() }).json()
  );

  const error = await fetchIt().catch((caught: unknown) => caught);
  assert.ok(error instanceof KTUAPIError);
  assert.equal(
    error.userMessage,
    "Unable to connect to KTU API. Please try again later."
  );
  assert.equal(error.statusCode, undefined);
  assert.ok(error.url?.startsWith("http://127.0.0.1:"));
  assert.ok(error.cause instanceof RequestError);
});

test("validation failures map to KTUAPIError with the Zod cause", async () => {
  const fetchIt = withKtuErrorMapper("fetchPrograms", async () =>
    z.string().parse(42)
  );

  const error = await fetchIt().catch((caught: unknown) => caught);
  assert.ok(error instanceof KTUAPIError);
  assert.equal(
    error.userMessage,
    "The API returned data in an unexpected format. Please try again later."
  );
  assert.ok(error.cause instanceof ZodError);
});

test("token-solver failures pass through unmapped", async () => {
  const solverError = new TokenSolverError(
    "Token solver responded with status 500"
  );
  const direct = withKtuErrorMapper(
    "fetchPrograms",
    async (): Promise<unknown> => {
      throw solverError;
    }
  );
  assert.strictEqual(
    await direct().catch((caught: unknown) => caught),
    solverError
  );

  // got wraps hook failures in RequestError; the solver cause must still
  // exempt the whole error from KTU mapping.
  const hooked = got.extend({
    hooks: {
      beforeRequest: [
        async () => {
          throw solverError;
        },
      ],
    },
  });
  const viaHook = withKtuErrorMapper("fetchPrograms", async () =>
    hooked.get("http://127.0.0.1:1/ktu").json()
  );
  const wrapped = await viaHook().catch((caught: unknown) => caught);
  assert.ok(wrapped instanceof RequestError);
  assert.ok(!(wrapped instanceof KTUAPIError));
  assert.ok(wrapped.cause instanceof TokenSolverError);
});

test("unrecognized failures pass through by reference", async () => {
  const original = new Error("boom");
  const fetchIt = withKtuErrorMapper(
    "fetchPrograms",
    async (): Promise<unknown> => {
      throw original;
    }
  );

  assert.strictEqual(
    await fetchIt().catch((caught: unknown) => caught),
    original
  );
});

test("file-host failures keep their original error", async () => {
  const error = await uploadTempFile({
    filePath: "/nonexistent-dir/missing.pdf",
    fileName: "missing.pdf",
  }).catch((caught: unknown) => caught);

  assert.ok(error instanceof Error);
  assert.ok(!(error instanceof KTUAPIError));
  assert.equal((error as NodeJS.ErrnoException).code, "ENOENT");
});
