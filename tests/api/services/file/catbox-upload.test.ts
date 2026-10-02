import assert from "node:assert/strict";
import { open, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import got from "got";
import { uploadTempFile } from "../../../../src/api/services/file/catbox-upload.js";

test("oversized file upload streams native multipart data with bounded memory", async t => {
  const directory = await mkdtemp(join(tmpdir(), "ktu-bot-upload-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "large.pdf");
  const file = await open(filePath, "w");
  const fileSize = 256 * 1024 * 1024;
  try {
    await file.truncate(fileSize);
  } finally {
    await file.close();
  }

  const before = process.memoryUsage().rss;
  let peak = before;
  let uploadedBytes = 0;
  let firstChunk = "";
  let contentType = "";
  const server = createServer((req, res) => {
    contentType = req.headers["content-type"] ?? "";
    req.on("data", (chunk: Buffer) => {
      if (firstChunk.length < 1024) {
        firstChunk += chunk.subarray(0, 1024 - firstChunk.length).toString();
      }
      uploadedBytes += chunk.length;
      peak = Math.max(peak, process.memoryUsage().rss);
    });
    req.on("end", () => res.end("https://files.catbox.moe/large.pdf\n"));
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
  const localClient = got.extend({
    hooks: {
      beforeRequest: [
        options => {
          options.url = new URL(`http://127.0.0.1:${address.port}/upload`);
        },
      ],
    },
  });
  t.mock.method(got, "post", localClient.post);

  assert.equal(
    await uploadTempFile({ filePath, fileName: "large.pdf" }),
    "https://files.catbox.moe/large.pdf"
  );
  peak = Math.max(peak, process.memoryUsage().rss);
  assert.match(contentType, /^multipart\/form-data; boundary=/);
  assert.match(firstChunk, /name="reqtype"/);
  assert.match(firstChunk, /fileupload/);
  assert.match(firstChunk, /name="fileToUpload"; filename="large.pdf"/);
  assert.ok(uploadedBytes > fileSize && uploadedBytes < fileSize + 1024);
  t.diagnostic(
    `256 MiB upload RSS growth: ${((peak - before) / 1024 / 1024).toFixed(1)} MiB`
  );
  assert.ok(
    peak - before < 128 * 1024 * 1024,
    `RSS grew by ${(peak - before) / 1024 / 1024} MiB`
  );
});
