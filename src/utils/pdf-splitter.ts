import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { promisify } from "node:util";
import {
  cleanupDownloadedAttachments,
  TELEGRAM_MAX_FILE_SIZE_BYTES,
  type DownloadedAttachment,
} from "./attachment-download.js";
import { cleanupTempFile, createTempFile } from "./file-utils.js";
import { combineFailures } from "../errors/combine-failures.js";

export const PDF_PART_TARGET_BYTES = 45 * 1024 * 1024;
const SPLIT_BUDGET_MS = 90_000;
const MAX_PARTS = 20;
const executeFile = promisify(execFile);

type PdfCommand = (
  args: readonly string[],
  timeoutMs: number
) => Promise<string>;
let pendingCommand: Promise<void> = Promise.resolve();

function remainingTime(deadline: number): number {
  const remaining = Math.ceil(deadline - performance.now());
  if (remaining <= 0) throw new Error("PDF splitting exceeded its time budget");
  return remaining;
}

// Jobs run concurrently, but overlapping qpdf processes could exhaust the worker's memory.
const runQpdf: PdfCommand = (args, timeoutMs) => {
  const deadline = performance.now() + timeoutMs;
  const command = pendingCommand.then(async () => {
    const result = await executeFile("qpdf", [...args], {
      timeout: remainingTime(deadline),
      killSignal: "SIGKILL",
      maxBuffer: 64 * 1024,
    });
    return result.stdout;
  });
  pendingCommand = command.then(
    () => undefined,
    () => undefined
  );
  return command;
};

interface PageRange {
  first: number;
  last: number;
}

/** Returns only newly created parts; the caller owns their cleanup after success. */
export async function splitPdfAttachment(
  original: DownloadedAttachment,
  command: PdfCommand = runQpdf
): Promise<DownloadedAttachment[]> {
  if (
    original.fileSizeBytes <= TELEGRAM_MAX_FILE_SIZE_BYTES ||
    extname(original.fileName).toLowerCase() !== ".pdf"
  ) {
    return [];
  }

  const deadline = performance.now() + SPLIT_BUDGET_MS;
  const run = (args: readonly string[]) =>
    command(args, remainingTime(deadline));
  const pageCount = Number(
    (await run(["--show-npages", original.tempFilePath])).trim()
  );
  if (!Number.isSafeInteger(pageCount) || pageCount < 1)
    throw new Error("Invalid PDF page count");
  if (pageCount === 1) return [];

  const midpoint = Math.floor(pageCount / 2);
  const pending: PageRange[] = [
    { first: 1, last: midpoint },
    { first: midpoint + 1, last: pageCount },
  ];
  const temporary: DownloadedAttachment[] = [];
  const parts: Array<DownloadedAttachment & PageRange> = [];
  try {
    while (pending.length > 0) {
      if (parts.length + pending.length > MAX_PARTS)
        throw new Error("PDF requires too many parts");
      const range = pending.shift()!;
      const tempFilePath = await createTempFile(
        Buffer.alloc(0),
        "pdf-part.pdf"
      );
      const file = { tempFilePath, fileName: "pdf-part.pdf", fileSizeBytes: 0 };
      temporary.push(file);
      await run([
        original.tempFilePath,
        "--pages",
        ".",
        `${range.first}-${range.last}`,
        "--",
        tempFilePath,
      ]);
      file.fileSizeBytes = (await stat(tempFilePath)).size;
      if (file.fileSizeBytes === 0)
        throw new Error("PDF splitter produced an empty file");
      if (file.fileSizeBytes <= PDF_PART_TARGET_BYTES) {
        parts.push({ ...file, ...range });
        continue;
      }
      await cleanupTempFile(tempFilePath);
      temporary.pop();
      if (range.first === range.last)
        throw new Error("A PDF page exceeds the part size limit");
      const middle = Math.floor((range.first + range.last) / 2);
      pending.unshift(
        { first: range.first, last: middle },
        { first: middle + 1, last: range.last }
      );
    }
    const stem = basename(original.fileName, extname(original.fileName));
    return parts.map((part, index) => ({
      tempFilePath: part.tempFilePath,
      fileSizeBytes: part.fileSizeBytes,
      fileName: `${stem} (part ${index + 1} of ${parts.length}, pages ${part.first}-${part.last}).pdf`,
    }));
  } catch (error) {
    const cleanupErrors = await cleanupDownloadedAttachments(temporary);
    throw combineFailures(
      "PDF splitting and temp file cleanup failed",
      error,
      cleanupErrors
    );
  }
}
