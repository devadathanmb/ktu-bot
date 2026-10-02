import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import test, { type TestContext } from "node:test";
import { createTempFile, cleanupTempFile } from "../../src/utils/file-utils.js";
import {
  cleanupDownloadedAttachments,
  TELEGRAM_MAX_FILE_SIZE_BYTES,
  type DownloadedAttachment,
} from "../../src/utils/attachment-download.js";
import {
  PDF_PART_TARGET_BYTES,
  splitPdfAttachment,
} from "../../src/utils/pdf-splitter.js";

async function fixture(
  t: TestContext,
  name = "syllabus.pdf"
): Promise<DownloadedAttachment> {
  const tempFilePath = await createTempFile(Buffer.from("original PDF"), name);
  t.after(() => cleanupTempFile(tempFilePath));
  return { tempFilePath, fileName: name, fileSizeBytes: 94 * 1024 * 1024 };
}

function pdfTool(t: TestContext, sizes: Record<string, number>, pages = "8") {
  const calls: string[] = [];
  const outputs: string[] = [];
  t.after(async () => {
    await Promise.all(outputs.map(cleanupTempFile));
  });
  const command = async (
    args: readonly string[],
    timeoutMs: number
  ): Promise<string> => {
    assert.ok(timeoutMs > 0 && timeoutMs <= 90_000);
    if (args[0] === "--show-npages") return pages;
    const range = args[3]!;
    const output = args.at(-1)!;
    assert.deepEqual(args.slice(1, 3), ["--pages", "."]);
    assert.equal(args[4], "--");
    calls.push(range);
    outputs.push(output);
    const file = await open(output, "w");
    try {
      await file.truncate(sizes[range] ?? 1024);
    } finally {
      await file.close();
    }
    return "";
  };
  return { command, calls, outputs };
}

test("small files and non-PDF files skip qpdf", async t => {
  const original = await fixture(t);
  const tool = pdfTool(t, {});
  assert.deepEqual(
    await splitPdfAttachment(
      { ...original, fileSizeBytes: TELEGRAM_MAX_FILE_SIZE_BYTES },
      tool.command
    ),
    []
  );
  assert.deepEqual(
    await splitPdfAttachment(
      { ...original, fileName: "archive.zip" },
      tool.command
    ),
    []
  );
  assert.deepEqual(tool.calls, []);
});

test("uneven PDF halves split adaptively, retain all pages, and label parts in order", async t => {
  const original = await fixture(t, "../../syllabus.PDF");
  const tool = pdfTool(t, {
    "1-4": 35 * 1024 * 1024,
    "5-8": 55 * 1024 * 1024,
    "5-6": 28 * 1024 * 1024,
    "7-8": 29 * 1024 * 1024,
  });
  const parts = await splitPdfAttachment(original, tool.command);
  t.after(async () => {
    assert.deepEqual(await cleanupDownloadedAttachments(parts), []);
  });
  assert.deepEqual(tool.calls, ["1-4", "5-8", "5-6", "7-8"]);
  assert.deepEqual(
    parts.map(part => part.fileName),
    [
      "syllabus (part 1 of 3, pages 1-4).pdf",
      "syllabus (part 2 of 3, pages 5-6).pdf",
      "syllabus (part 3 of 3, pages 7-8).pdf",
    ]
  );
  for (const part of parts) {
    assert.ok(part.fileSizeBytes <= PDF_PART_TARGET_BYTES);
    assert.equal((await stat(part.tempFilePath)).size, part.fileSizeBytes);
  }
  await assert.rejects(stat(tool.outputs[1]!));
  assert.equal(
    (await readFile(original.tempFilePath)).toString(),
    "original PDF"
  );
});

test("one-page oversized PDF falls back without creating parts", async t => {
  const tool = pdfTool(t, {}, "1");
  assert.deepEqual(
    await splitPdfAttachment(await fixture(t), tool.command),
    []
  );
  assert.deepEqual(tool.outputs, []);
});

test("an unsplittable page cleans all partial parts", async t => {
  const original = await fixture(t);
  const tool = pdfTool(t, {
    "5-8": 60 * 1024 * 1024,
    "5-6": 60 * 1024 * 1024,
    "5-5": 60 * 1024 * 1024,
  });
  await assert.rejects(
    splitPdfAttachment(original, tool.command),
    /page exceeds/
  );
  for (const path of tool.outputs) await assert.rejects(stat(path));
  await stat(original.tempFilePath);
});

test("qpdf failures remove finished and unfinished parts", async t => {
  const original = await fixture(t);
  const tool = pdfTool(t, {});
  const failure = new Error("qpdf timed out");
  const command: typeof tool.command = async (args, timeoutMs) => {
    const result = await tool.command(args, timeoutMs);
    if (tool.calls.length === 2) throw failure;
    return result;
  };
  await assert.rejects(
    splitPdfAttachment(original, command),
    error => error === failure
  );
  for (const path of tool.outputs) await assert.rejects(stat(path));
});

test("split and cleanup failures are both preserved", async t => {
  const original = await fixture(t);
  const failure = new Error("qpdf failed");
  const outputs: string[] = [];
  t.after(async () => {
    await Promise.all(
      outputs.map(path => rm(path, { recursive: true, force: true }))
    );
  });
  const command: Parameters<typeof splitPdfAttachment>[1] = async args => {
    if (args[0] === "--show-npages") return "2";
    const output = args.at(-1)!;
    outputs.push(output);
    // A directory forces a real unlink failure without depending on permissions.
    await rm(output);
    await mkdir(output);
    throw failure;
  };
  const caught = await splitPdfAttachment(original, command).catch(
    (error: unknown) => error
  );
  assert.ok(caught instanceof AggregateError);
  assert.strictEqual(caught.cause, failure);
  assert.strictEqual(caught.errors[0], failure);
  assert.equal(caught.errors.length, 2);
  assert.ok(caught.errors[1] instanceof Error);
});

test("invalid page counts fail before creating parts", async t => {
  const original = await fixture(t);
  for (const count of ["", "0", "-1", "NaN", "1.5", "9007199254740992"]) {
    const tool = pdfTool(t, {}, count);
    await assert.rejects(
      splitPdfAttachment(original, tool.command),
      /page count/
    );
    assert.deepEqual(tool.outputs, []);
  }
});

test("empty output is rejected and cleaned up", async t => {
  const tool = pdfTool(t, { "1-4": 0 });
  await assert.rejects(
    splitPdfAttachment(await fixture(t), tool.command),
    /empty file/
  );
  await assert.rejects(stat(tool.outputs[0]!));
});

test("excessive splitting stops before flooding a chat with parts", async t => {
  const original = await fixture(t);
  const tool = pdfTool(t, {}, "64");
  const command: typeof tool.command = async (args, timeoutMs) => {
    if (args[0] !== "--show-npages") {
      const [first, last] = args[3]!.split("-").map(Number);
      return tool.command(args, timeoutMs).then(async result => {
        if (first !== last) {
          const file = await open(args.at(-1)!, "w");
          try {
            await file.truncate(PDF_PART_TARGET_BYTES + 1);
          } finally {
            await file.close();
          }
        }
        return result;
      });
    }
    return tool.command(args, timeoutMs);
  };
  await assert.rejects(splitPdfAttachment(original, command), /too many parts/);
  for (const path of tool.outputs) await assert.rejects(stat(path));
});

let hasQpdf = false;
try {
  execFileSync("qpdf", ["--version"], { stdio: "ignore" });
  hasQpdf = true;
} catch {
  /* Docker installs qpdf; local unit tests don't require it. */
}

test(
  "real qpdf produces valid page-range PDFs",
  { skip: !hasQpdf },
  async t => {
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Count 4 /Kids [3 0 R 4 0 R 5 0 R 6 0 R] >>",
      ...Array.from(
        { length: 4 },
        () =>
          "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>"
      ),
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const [index, object] of objects.entries()) {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    }
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
    pdf += offsets
      .slice(1)
      .map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`)
      .join("");
    pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const tempFilePath = await createTempFile(Buffer.from(pdf), "fixture.pdf");
    t.after(() => cleanupTempFile(tempFilePath));
    // Exercise the real parser using a small fixture; oversized-size gating is covered separately.
    const parts = await splitPdfAttachment({
      tempFilePath,
      fileName: "fixture.pdf",
      fileSizeBytes: TELEGRAM_MAX_FILE_SIZE_BYTES + 1,
    });
    t.after(async () => {
      assert.deepEqual(await cleanupDownloadedAttachments(parts), []);
    });
    assert.equal(parts.length, 2);
    for (const part of parts) {
      assert.equal(
        execFileSync("qpdf", ["--show-npages", part.tempFilePath], {
          encoding: "utf8",
        }).trim(),
        "2"
      );
      execFileSync("qpdf", ["--check", part.tempFilePath], { stdio: "ignore" });
    }
  }
);
