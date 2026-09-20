import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  cleanupDownloadedAttachment,
  downloadAttachmentToTempFile,
  withDownloadedAttachment,
} from "../../src/utils/attachment-download.js";
import { cleanupTempFile, createTempFile } from "../../src/utils/file-utils.js";

const HELLO_BASE64 = Buffer.from("hello ktu").toString("base64");

test("default and syllabus sources use their own fetchers", async () => {
  const calls: string[] = [];
  const fetchers = {
    fetchDefault: async (encryptId: string) => {
      calls.push(`default:${encryptId}`);
      return HELLO_BASE64;
    },
    fetchSyllabus: async ({ encryptId }: { encryptId: string }) => {
      calls.push(`syllabus:${encryptId}`);
      return HELLO_BASE64;
    },
  };

  const fromDefault = await downloadAttachmentToTempFile(
    "enc-1",
    "a.pdf",
    "default",
    fetchers
  );
  const fromSyllabus = await downloadAttachmentToTempFile(
    "enc-2",
    "b.pdf",
    "syllabus",
    fetchers
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
    await cleanupDownloadedAttachment(fromDefault);
    await cleanupDownloadedAttachment(fromSyllabus);
  }
});

test("unsafe encryptId characters never reach the filesystem name", async () => {
  const downloaded = await downloadAttachmentToTempFile(
    "../../enc:1/\\?*",
    "a.pdf",
    "default",
    { fetchDefault: async () => HELLO_BASE64 }
  );

  try {
    const base = downloaded.tempFilePath.split("/").at(-1) ?? "";
    assert.ok(base.includes("enc_1"));
    assert.ok(base.endsWith("a.pdf"));
    assert.doesNotMatch(base, /[/\\:?*]/);
    await stat(downloaded.tempFilePath);
  } finally {
    await cleanupDownloadedAttachment(downloaded);
  }
});

test("fetch failures propagate", async () => {
  await assert.rejects(
    downloadAttachmentToTempFile("enc-1", "a.pdf", "default", {
      fetchDefault: async () => {
        throw new Error("ktu down");
      },
    }),
    /ktu down/
  );
});

test("withDownloadedAttachment always cleans up", async () => {
  const fetchers = { fetchDefault: async () => HELLO_BASE64 };
  let seenPath = "";

  const result = await withDownloadedAttachment(
    "enc-1",
    "a.pdf",
    "default",
    async downloaded => {
      seenPath = downloaded.tempFilePath;
      return "done";
    },
    fetchers
  );

  assert.equal(result, "done");
  await assert.rejects(stat(seenPath));

  let failedPath = "";
  await assert.rejects(
    withDownloadedAttachment(
      "enc-1",
      "a.pdf",
      "default",
      async downloaded => {
        failedPath = downloaded.tempFilePath;
        throw new Error("consumer failed");
      },
      fetchers
    ),
    /consumer failed/
  );
  await assert.rejects(stat(failedPath));
});

test("temp file helpers round-trip and tolerate missing files", async () => {
  const path = await createTempFile(Buffer.from("data"), "unit.pdf");
  assert.deepEqual(await readFile(path), Buffer.from("data"));

  await cleanupTempFile(path);
  await assert.rejects(stat(path));
  await cleanupTempFile(path);
});
