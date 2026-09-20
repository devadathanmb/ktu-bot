import {
  fetchAttachment,
  fetchSyllabusAttachment,
} from "../api/services/ktu/index.js";
import type { AttachmentSource } from "../types/service.types.js";
import { cleanupTempFile, createTempFile } from "./file-utils.js";
import logger from "./logger.js";

export const TELEGRAM_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export interface DownloadedAttachment {
  tempFilePath: string;
  fileName: string;
  fileSizeBytes: number;
}

export interface AttachmentFetchers {
  fetchDefault?: (encryptId: string) => Promise<string>;
  fetchSyllabus?: (params: { encryptId: string }) => Promise<string>;
}

export async function downloadAttachmentToTempFile(
  encryptId: string,
  fileName: string,
  source: AttachmentSource = "default",
  fetchers: AttachmentFetchers = {}
): Promise<DownloadedAttachment> {
  const fetchDefault = fetchers.fetchDefault ?? fetchAttachment;
  const fetchSyllabus = fetchers.fetchSyllabus ?? fetchSyllabusAttachment;
  const base64Data =
    source === "syllabus"
      ? await fetchSyllabus({ encryptId })
      : await fetchDefault(encryptId);

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

export async function cleanupDownloadedAttachment(
  downloaded: DownloadedAttachment
): Promise<void> {
  await cleanupTempFile(downloaded.tempFilePath);
}

/**
 * Download an attachment and run an operation with automatic temp file cleanup.
 * The temp file is always deleted, even if the operation throws.
 */
export async function withDownloadedAttachment<T>(
  encryptId: string,
  fileName: string,
  source: AttachmentSource,
  operation: (downloaded: DownloadedAttachment) => Promise<T>,
  fetchers: AttachmentFetchers = {}
): Promise<T> {
  const downloaded = await downloadAttachmentToTempFile(
    encryptId,
    fileName,
    source,
    fetchers
  );
  try {
    return await operation(downloaded);
  } finally {
    await cleanupDownloadedAttachment(downloaded);
  }
}
