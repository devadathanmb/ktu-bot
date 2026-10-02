import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import {
  fetchAttachment,
  fetchSyllabusAttachment,
  type AttachmentResponseConsumer,
} from "../api/services/ktu/index.js";
import type { AttachmentSource } from "../types/service.types.js";
import { combineFailures } from "../errors/combine-failures.js";
import { cleanupTempFile, createTempFile } from "./file-utils.js";
import logger from "./logger.js";

export const TELEGRAM_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export interface DownloadedAttachment {
  tempFilePath: string;
  fileName: string;
  fileSizeBytes: number;
}

export interface AttachmentFetcherDeps {
  fetchAttachment: typeof fetchAttachment;
  fetchSyllabusAttachment: typeof fetchSyllabusAttachment;
}

const Base64ChunkSchema = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);
const CompleteBase64Schema = z
  .string()
  .regex(
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    "Invalid base64 padding"
  );
const Base64TailSchema = z
  .string()
  .regex(/^(?:[A-Za-z0-9+/]{2,3})?$/, "Incomplete base64 attachment");
const EndOfBase64Schema = z.literal("", { error: "Data after base64 padding" });
const AttachmentSizeSchema = z
  .number()
  .positive("Attachment data cannot be empty");
const DECODE_CHUNK_SIZE = 64 * 1024;

async function* decodeAttachment(
  response: AsyncIterable<Buffer>
): AsyncGenerator<Buffer> {
  let carry = "";
  let filenameStarted = false;
  let padded = false;

  for await (const chunk of response) {
    if (filenameStarted) continue;
    // Bound decoding allocations even if a source yields an unusually large chunk.
    for (let offset = 0; offset < chunk.length; offset += DECODE_CHUNK_SIZE) {
      let data =
        carry +
        chunk.subarray(offset, offset + DECODE_CHUNK_SIZE).toString("utf8");
      carry = "";
      const separator = data.indexOf("&&");
      if (separator !== -1) {
        data = data.slice(0, separator);
        filenameStarted = true;
      } else if (data.endsWith("&")) {
        carry = "&";
        data = data.slice(0, -1);
      }
      data = data.replace(/\s/g, "");
      Base64ChunkSchema.parse(data);
      if (padded) EndOfBase64Schema.parse(data);
      const completeLength = data.length - (data.length % 4);
      carry = data.slice(completeLength) + carry;
      if (completeLength > 0) {
        const complete = CompleteBase64Schema.parse(
          data.slice(0, completeLength)
        );
        padded = complete.includes("=");
        yield Buffer.from(complete, "base64");
      }
      if (filenameStarted) break;
    }
  }

  Base64TailSchema.parse(carry);
  if (padded) EndOfBase64Schema.parse(carry);
  if (carry.length > 0) {
    yield Buffer.from(carry, "base64");
  }
}

async function cleanupAndRethrow(
  tempFilePath: string,
  error: unknown,
  message: string
): Promise<never> {
  try {
    await cleanupTempFile(tempFilePath);
  } catch (cleanupError) {
    throw combineFailures(message, error, [cleanupError]);
  }
  throw error;
}

export interface AttachmentDownloadService {
  downloadAttachmentToTempFile: (
    encryptId: string,
    fileName: string,
    source?: AttachmentSource
  ) => Promise<DownloadedAttachment>;
  cleanupDownloadedAttachment: (
    downloaded: DownloadedAttachment
  ) => Promise<void>;
  /**
   * Download an attachment and run an operation with automatic temp file cleanup.
   * The temp file is always deleted, even if the operation throws.
   * When both the operation and the cleanup fail, both failures are preserved
   * as an AggregateError instead of the cleanup failure replacing the original.
   */
  withDownloadedAttachment: <T>(
    encryptId: string,
    fileName: string,
    source: AttachmentSource,
    operation: (downloaded: DownloadedAttachment) => Promise<T>
  ) => Promise<T>;
}

export function createAttachmentDownloadService(
  deps: AttachmentFetcherDeps
): AttachmentDownloadService {
  async function downloadAttachmentToTempFile(
    encryptId: string,
    fileName: string,
    source: AttachmentSource = "default"
  ): Promise<DownloadedAttachment> {
    const safeEncryptId = encryptId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const tempFilePath = await createTempFile(
      Buffer.alloc(0),
      `${safeEncryptId}_${fileName}`
    );
    let fileSizeBytes = 0;
    const consumeResponse: AttachmentResponseConsumer = async response => {
      await pipeline(
        response,
        decodeAttachment,
        createWriteStream(tempFilePath)
      );
      fileSizeBytes = AttachmentSizeSchema.parse(
        (await stat(tempFilePath)).size
      );
    };

    try {
      if (source === "syllabus") {
        await deps.fetchSyllabusAttachment({ encryptId, consumeResponse });
      } else {
        await deps.fetchAttachment(encryptId, consumeResponse);
      }
    } catch (error) {
      return cleanupAndRethrow(
        tempFilePath,
        error,
        "Attachment download and cleanup failed"
      );
    }

    logger.info({ fileName, source, fileSizeBytes }, "Attachment downloaded");

    return { tempFilePath, fileName, fileSizeBytes };
  }

  async function cleanupDownloadedAttachment(
    downloaded: DownloadedAttachment
  ): Promise<void> {
    await cleanupTempFile(downloaded.tempFilePath);
  }

  async function withDownloadedAttachment<T>(
    encryptId: string,
    fileName: string,
    source: AttachmentSource,
    operation: (downloaded: DownloadedAttachment) => Promise<T>
  ): Promise<T> {
    const downloaded = await downloadAttachmentToTempFile(
      encryptId,
      fileName,
      source
    );

    let result: T;
    try {
      result = await operation(downloaded);
    } catch (operationError) {
      return cleanupAndRethrow(
        downloaded.tempFilePath,
        operationError,
        "Attachment operation failed and temp file cleanup failed"
      );
    }

    await cleanupDownloadedAttachment(downloaded);
    return result;
  }

  return {
    downloadAttachmentToTempFile,
    cleanupDownloadedAttachment,
    withDownloadedAttachment,
  };
}

const productionAttachmentDownload = createAttachmentDownloadService({
  fetchAttachment,
  fetchSyllabusAttachment,
});

export const downloadAttachmentToTempFile =
  productionAttachmentDownload.downloadAttachmentToTempFile;
export const cleanupDownloadedAttachment =
  productionAttachmentDownload.cleanupDownloadedAttachment;
export const withDownloadedAttachment =
  productionAttachmentDownload.withDownloadedAttachment;

export async function cleanupDownloadedAttachments(
  downloaded: readonly DownloadedAttachment[],
  cleanup: typeof cleanupDownloadedAttachment = cleanupDownloadedAttachment
): Promise<unknown[]> {
  const results = await Promise.allSettled(
    downloaded.map(file => cleanup(file))
  );
  return results.flatMap(result =>
    result.status === "rejected" ? [result.reason as unknown] : []
  );
}
