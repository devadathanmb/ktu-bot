import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { Readable } from "node:stream";
import test from "node:test";
import got from "got";
import { fetchSyllabusAttachment } from "../../../../src/api/services/ktu/fetch-syllabus-attachment.js";
import { KTUAPIError } from "../../../../src/errors/bot-errors.js";

test(
  "syllabus response is consumed before the HTTP download finishes",
  { timeout: 5000 },
  async t => {
    let consumedFirstChunk: () => void = () => {};
    const consumed = new Promise<void>(resolve => {
      consumedFirstChunk = resolve;
    });
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.write("aGVs");
      void consumed.then(() => res.end("bG8=&&test.pdf"));
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      });
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const apiClient = got.extend({
      hooks: {
        beforeRequest: [
          options => {
            options.url = new URL(
              `http://127.0.0.1:${address.port}/attachment`
            );
          },
        ],
      },
    });
    let body = "";
    await fetchSyllabusAttachment({
      encryptId: "id",
      apiClient,
      consumeResponse: async response => {
        for await (const chunk of response) {
          body += String(chunk);
          consumedFirstChunk();
        }
      },
    });
    assert.equal(body, "aGVsbG8=&&test.pdf");
  }
);

test("streaming HTTP failures still use the KTU error mapper", async t => {
  const server = createServer((_req, res) => {
    res.writeHead(503);
    res.end("unavailable");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const apiClient = got.extend({
    retry: { limit: 0 },
    hooks: {
      beforeRequest: [
        options => {
          options.url = new URL(`http://127.0.0.1:${address.port}/attachment`);
        },
      ],
    },
  });
  await assert.rejects(
    fetchSyllabusAttachment({
      encryptId: "id",
      apiClient,
      consumeResponse: async response => {
        for await (const chunk of response) {
          assert.ok(Buffer.isBuffer(chunk));
        }
      },
    }),
    KTUAPIError
  );
});

test("a consumer failure before reading destroys the request and preserves the error", async () => {
  const failure = new Error("destination unavailable");
  let request: Readable | undefined;
  await assert.rejects(
    fetchSyllabusAttachment({
      encryptId: "id",
      apiClient: got.extend({
        hooks: {
          beforeRequest: [
            options => {
              options.url = new URL("http://127.0.0.1:1/attachment");
            },
          ],
        },
      }),
      consumeResponse: async response => {
        request = response;
        throw failure;
      },
    }),
    error => error === failure
  );
  assert.ok(request?.destroyed);
});
