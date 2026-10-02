import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { Readable } from "node:stream";
import {
  createAttachmentDownloadService,
  type AttachmentFetcherDeps,
} from "../../src/utils/attachment-download.js";
import { cleanupTempFile, createTempFile } from "../../src/utils/file-utils.js";

const HELLO_BASE64 = Buffer.from("hello ktu").toString("base64");

function createService(overrides: Partial<AttachmentFetcherDeps> = {}) {
  return createAttachmentDownloadService({
    fetchAttachment: async (_encryptId, consumeResponse) =>
      consumeResponse(Readable.from([Buffer.from(HELLO_BASE64)])),
    fetchSyllabusAttachment: async ({ consumeResponse }) =>
      consumeResponse(Readable.from([Buffer.from(HELLO_BASE64)])),
    ...overrides,
  });
}

test("default and syllabus sources use their own fetchers", async () => {
  const calls: string[] = [];
  const service = createAttachmentDownloadService({
    fetchAttachment: async (encryptId, consumeResponse) => {
      calls.push(`default:${encryptId}`);
      await consumeResponse(Readable.from([Buffer.from(HELLO_BASE64)]));
    },
    fetchSyllabusAttachment: async ({ encryptId, consumeResponse }) => {
      calls.push(`syllabus:${encryptId}`);
      await consumeResponse(Readable.from([Buffer.from(HELLO_BASE64)]));
    },
  });

  const fromDefault = await service.downloadAttachmentToTempFile(
    "enc-1",
    "a.pdf",
    "default"
  );
  const fromSyllabus = await service.downloadAttachmentToTempFile(
    "enc-2",
    "b.pdf",
    "syllabus"
  );

  try {
    assert.deepEqual(calls, ["default:enc-1", "syllabus:enc-2"]);
    assert.equal(fromDefault.fileSizeBytes, Buffer.byteLength("hello ktu"));
    assert.equal(fromSyllabus.fileSizeBytes, Buffer.byteLength("hello ktu"));
    assert.deepEqual(
      await readFile(fromDefault.tempFilePath),
      Buffer.from("hello ktu")
    );
    assert.deepEqual(
      await readFile(fromSyllabus.tempFilePath),
      Buffer.from("hello ktu")
    );
  } finally {
    await service.cleanupDownloadedAttachment(fromDefault);
    await service.cleanupDownloadedAttachment(fromSyllabus);
  }
});

test("unsafe encryptId characters never reach the filesystem name", async () => {
  const service = createService();
  const downloaded = await service.downloadAttachmentToTempFile(
    "../../enc:1/\\?*",
    "a.pdf",
    "default"
  );

  try {
    const base = downloaded.tempFilePath.split("/").at(-1) ?? "";
    assert.ok(base.includes("enc_1"));
    assert.ok(base.endsWith("a.pdf"));
    assert.doesNotMatch(base, /[/\\:?*]/);
    await stat(downloaded.tempFilePath);
  } finally {
    await service.cleanupDownloadedAttachment(downloaded);
  }
});

test("fetch failures propagate", async () => {
  const service = createService({
    fetchAttachment: async () => {
      throw new Error("ktu down");
    },
  });

  await assert.rejects(
    service.downloadAttachmentToTempFile("enc-1", "a.pdf", "default"),
    /ktu down/
  );
});

test("syllabus base64 and filename delimiters can split at every byte boundary", async () => {
  for (const text of [
    HELLO_BASE64,
    `${HELLO_BASE64}&&ignored.pdf`,
    "YQ==&&a.pdf",
    "YWI=&&b.pdf",
    "YQ&&a.pdf",
    `${HELLO_BASE64.slice(0, 3)}\r\n${HELLO_BASE64.slice(3)}&&ignored.pdf`,
  ]) {
    const service = createService({
      fetchSyllabusAttachment: async ({ consumeResponse }) => {
        await consumeResponse(
          Readable.from(Array.from(text, char => Buffer.from(char)))
        );
      },
    });
    const downloaded = await service.downloadAttachmentToTempFile(
      "split",
      "a.pdf",
      "syllabus"
    );
    try {
      const expected = Buffer.from(text.split("&&")[0]!, "base64");
      assert.deepEqual(await readFile(downloaded.tempFilePath), expected);
      assert.equal(downloaded.fileSizeBytes, expected.length);
    } finally {
      await service.cleanupDownloadedAttachment(downloaded);
    }
  }
});

test("a single large response chunk ignores the syllabus filename after the delimiter", async () => {
  const original = Buffer.alloc(100 * 1024, 65);
  const service = createService({
    fetchSyllabusAttachment: async ({ consumeResponse }) => {
      await consumeResponse(
        Readable.from([
          Buffer.from(`${original.toString("base64")}&&large.pdf`),
        ])
      );
    },
  });
  const downloaded = await service.downloadAttachmentToTempFile(
    "single-chunk",
    "large.pdf",
    "syllabus"
  );
  try {
    assert.deepEqual(await readFile(downloaded.tempFilePath), original);
    assert.equal(downloaded.fileSizeBytes, original.length);
  } finally {
    await service.cleanupDownloadedAttachment(downloaded);
  }
});

test("regular attachments also strip the API filename suffix across chunks", async () => {
  const data = `${HELLO_BASE64}&&KTU-EX-II5-1797-2025(25).pdf`;
  const service = createService({
    fetchAttachment: async (_encryptId, consumeResponse) => {
      await consumeResponse(
        Readable.from(Array.from(data, char => Buffer.from(char)))
      );
    },
  });
  const downloaded = await service.downloadAttachmentToTempFile(
    "regular-suffix",
    "a.pdf"
  );
  try {
    assert.deepEqual(
      await readFile(downloaded.tempFilePath),
      Buffer.from("hello ktu")
    );
    assert.equal(downloaded.fileSizeBytes, Buffer.byteLength("hello ktu"));
  } finally {
    await service.cleanupDownloadedAttachment(downloaded);
  }
});

test("streaming failures and invalid responses remove partial temp files", async () => {
  for (const invalid of [
    "",
    "not base64!",
    "Y",
    "YQ==YQ==",
    "YWJjYQ=",
    "YWJjY=",
    "YWJjYWI==",
    "YWJj=AAA",
  ]) {
    for (const chunks of [
      [Buffer.from(invalid)],
      Array.from(invalid, char => Buffer.from(char)),
    ]) {
      const service = createService({
        fetchAttachment: async (_encryptId, consumeResponse) => {
          await consumeResponse(Readable.from(chunks));
        },
      });
      await assert.rejects(
        service.downloadAttachmentToTempFile("invalid-stream", "a.pdf")
      );
    }
  }
  const service = createService({
    fetchAttachment: async (_encryptId, consumeResponse) => {
      await consumeResponse(
        Readable.from(
          (async function* () {
            yield Buffer.from(HELLO_BASE64);
            throw new Error("connection lost mid-download");
          })()
        )
      );
    },
  });
  await assert.rejects(
    service.downloadAttachmentToTempFile("broken-stream", "a.pdf"),
    /connection lost/
  );
  const files = await readdir(join(tmpdir(), "ktu-bot-attachments"));
  assert.equal(
    files.some(
      file => file.includes("invalid-stream") || file.includes("broken-stream")
    ),
    false
  );
});

test("192 MiB attachment is decoded with bounded memory", async t => {
  const chunk = Buffer.alloc(48 * 1024, 65).toString("base64");
  const before = process.memoryUsage().rss;
  let peak = before;
  const service = createService({
    fetchSyllabusAttachment: async ({ consumeResponse }) => {
      await consumeResponse(
        Readable.from(
          (async function* () {
            for (let i = 0; i < 4096; i++) {
              peak = Math.max(peak, process.memoryUsage().rss);
              yield Buffer.from(chunk);
            }
            yield Buffer.from("&&large.pdf");
          })()
        )
      );
    },
  });
  const downloaded = await service.downloadAttachmentToTempFile(
    "large",
    "large.pdf",
    "syllabus"
  );
  try {
    peak = Math.max(peak, process.memoryUsage().rss);
    assert.equal(downloaded.fileSizeBytes, 192 * 1024 * 1024);
    assert.equal(
      (await stat(downloaded.tempFilePath)).size,
      downloaded.fileSizeBytes
    );
    t.diagnostic(
      `192 MiB download RSS growth: ${((peak - before) / 1024 / 1024).toFixed(1)} MiB`
    );
    assert.ok(
      peak - before < 96 * 1024 * 1024,
      `RSS grew by ${(peak - before) / 1024 / 1024} MiB`
    );
  } finally {
    await service.cleanupDownloadedAttachment(downloaded);
  }
});

test("download and partial-file cleanup failures are both preserved", async () => {
  const marker = `download-cleanup-${randomUUID()}`;
  const tempDirectory = join(tmpdir(), "ktu-bot-attachments");
  const failure = new Error("download failed after writing");
  let cleanupTarget: string | undefined;
  const service = createService({
    fetchAttachment: async (_encryptId, consumeResponse) => {
      await consumeResponse(Readable.from([Buffer.from(HELLO_BASE64)]));
      const fileName = (await readdir(tempDirectory)).find(name =>
        name.includes(marker)
      );
      assert.ok(fileName);
      cleanupTarget = join(tempDirectory, fileName);
      // Replace this test's file with a directory to force unlink to fail.
      await rm(cleanupTarget);
      await mkdir(cleanupTarget);
      throw failure;
    },
  });
  try {
    const caught = await service
      .downloadAttachmentToTempFile(marker, "a.pdf")
      .catch((error: unknown) => error);
    assert.ok(caught instanceof AggregateError);
    assert.equal(caught.errors.length, 2);
    assert.strictEqual(caught.cause, failure);
    assert.strictEqual(caught.errors[0], failure);
    assert.ok(caught.errors[1] instanceof Error);
  } finally {
    if (cleanupTarget)
      await rm(cleanupTarget, { recursive: true, force: true });
  }
});

test("withDownloadedAttachment always cleans up", async () => {
  const service = createService();
  let seenPath = "";

  const result = await service.withDownloadedAttachment(
    "enc-1",
    "a.pdf",
    "default",
    async downloaded => {
      seenPath = downloaded.tempFilePath;
      return "done";
    }
  );

  assert.equal(result, "done");
  await assert.rejects(stat(seenPath));

  let failedPath = "";
  await assert.rejects(
    service.withDownloadedAttachment(
      "enc-1",
      "a.pdf",
      "default",
      async downloaded => {
        failedPath = downloaded.tempFilePath;
        throw new Error("consumer failed");
      }
    ),
    /consumer failed/
  );
  await assert.rejects(stat(failedPath));
});

test("operation and cleanup failures are both preserved", async () => {
  const service = createService();
  const cleanupTarget = await mkdtemp(join(tmpdir(), "ktu-bot-cleanup-"));
  const operationError = new Error("consumer failed");

  try {
    const caught = await service
      .withDownloadedAttachment(
        "enc-1",
        "a.pdf",
        "default",
        async downloaded => {
          // Point cleanup at a directory: unlinking it is a deterministic
          // non-ENOENT failure without relying on file permissions.
          await rm(downloaded.tempFilePath, { force: true });
          downloaded.tempFilePath = cleanupTarget;
          throw operationError;
        }
      )
      .catch((error: unknown) => error);

    assert.ok(caught instanceof AggregateError);
    assert.equal(caught.errors.length, 2);
    assert.strictEqual(caught.errors[0], operationError);
    assert.strictEqual(caught.cause, operationError);
    assert.match(
      caught.message,
      /operation failed and temp file cleanup failed/
    );
    const cleanupError = caught.errors[1] as NodeJS.ErrnoException;
    assert.notEqual(cleanupError.code, "ENOENT");
  } finally {
    await rm(cleanupTarget, { recursive: true, force: true });
  }
});

test("a cleanup-only failure propagates unchanged", async () => {
  const service = createService();
  const cleanupTarget = await mkdtemp(join(tmpdir(), "ktu-bot-cleanup-"));

  try {
    const caught = await service
      .withDownloadedAttachment(
        "enc-1",
        "a.pdf",
        "default",
        async downloaded => {
          await rm(downloaded.tempFilePath, { force: true });
          downloaded.tempFilePath = cleanupTarget;
          return "done";
        }
      )
      .catch((error: unknown) => error);

    assert.ok(caught instanceof Error);
    assert.ok(!(caught instanceof AggregateError));
    assert.notEqual((caught as NodeJS.ErrnoException).code, "ENOENT");
  } finally {
    await rm(cleanupTarget, { recursive: true, force: true });
  }
});

test("temp file helpers round-trip and tolerate missing files", async () => {
  const path = await createTempFile(Buffer.from("data"), "unit.pdf");
  assert.deepEqual(await readFile(path), Buffer.from("data"));

  await cleanupTempFile(path);
  await assert.rejects(stat(path));
  await cleanupTempFile(path);
});

test("temp file names stay inside the attachments directory", async () => {
  const path = await createTempFile(Buffer.from("data"), "../../../escape.pdf");

  try {
    assert.equal(dirname(path), join(tmpdir(), "ktu-bot-attachments"));
    const base = basename(path);
    assert.equal(base.includes(".."), false);
    assert.equal(base.includes("/"), false);
    assert.ok(base.endsWith("escape.pdf"));
    await stat(path);
  } finally {
    await cleanupTempFile(path);
  }
});

test("same-name temp files created together never collide", async () => {
  const [first, second] = await Promise.all([
    createTempFile(Buffer.from("first"), "same.pdf"),
    createTempFile(Buffer.from("second"), "same.pdf"),
  ]);

  try {
    assert.notEqual(first, second);
    assert.deepEqual(await readFile(first), Buffer.from("first"));
    assert.deepEqual(await readFile(second), Buffer.from("second"));
  } finally {
    await cleanupTempFile(first);
    await cleanupTempFile(second);
  }
});

test("cleanup failures other than ENOENT propagate", async () => {
  // A directory cannot be unlinked, which gives a deterministic non-ENOENT
  // failure without relying on file permissions.
  const directory = await mkdtemp(join(tmpdir(), "ktu-bot-cleanup-"));

  try {
    await assert.rejects(cleanupTempFile(directory), (error: unknown) => {
      assert.notEqual((error as NodeJS.ErrnoException).code, "ENOENT");
      return true;
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
