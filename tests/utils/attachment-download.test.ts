import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import {
  createAttachmentDownloadService,
  type AttachmentFetcherDeps,
} from "../../src/utils/attachment-download.js";
import { cleanupTempFile, createTempFile } from "../../src/utils/file-utils.js";

const HELLO_BASE64 = Buffer.from("hello ktu").toString("base64");

function createService(overrides: Partial<AttachmentFetcherDeps> = {}) {
  return createAttachmentDownloadService({
    fetchAttachment: async () => HELLO_BASE64,
    fetchSyllabusAttachment: async () => HELLO_BASE64,
    ...overrides,
  });
}

test("default and syllabus sources use their own fetchers", async () => {
  const calls: string[] = [];
  const service = createAttachmentDownloadService({
    fetchAttachment: async (encryptId: string) => {
      calls.push(`default:${encryptId}`);
      return HELLO_BASE64;
    },
    fetchSyllabusAttachment: async ({ encryptId }: { encryptId: string }) => {
      calls.push(`syllabus:${encryptId}`);
      return HELLO_BASE64;
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
