import {
  fetchAttachment,
  fetchSyllabusAttachment,
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

// Every dependency is required: callers build a service with the fetchers they
// need, and the exported operations below compose the live KTU fetchers once.
export interface AttachmentFetcherDeps {
  fetchAttachment: (encryptId: string) => Promise<string>;
  fetchSyllabusAttachment: (params: { encryptId: string }) => Promise<string>;
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
    const base64Data =
      source === "syllabus"
        ? await deps.fetchSyllabusAttachment({ encryptId })
        : await deps.fetchAttachment(encryptId);

    const decodedSize = Buffer.byteLength(base64Data, "base64");

    logger.info(
      { fileName, source, fileSizeBytes: decodedSize },
      "Attachment downloaded"
    );

    // Write to disk so the base64 string can be GC'd before we use the file.
    // Keeps peak memory at ~decodedSize rather than ~3x decodedSize
    // (base64 string + decoded buffer could be held simultaneously otherwise).
    const safeEncryptId = encryptId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const tempFilePath = await createTempFile(
      Buffer.from(base64Data, "base64"),
      `${safeEncryptId}_${fileName}`
    );

    return { tempFilePath, fileName, fileSizeBytes: decodedSize };
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
      try {
        await cleanupDownloadedAttachment(downloaded);
      } catch (cleanupError) {
        throw combineFailures(
          "Attachment operation failed and temp file cleanup failed",
          operationError,
          [cleanupError]
        );
      }
      throw operationError;
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
