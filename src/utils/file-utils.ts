import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  fetchAttachment,
  fetchSyllabusAttachment,
} from "../api/services/index.js";
import type { AttachmentSource } from "../types/service.types.js";
import logger from "../utils/logger.js";

export const TELEGRAM_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const ATTACHMENT_TEMP_DIR = join(tmpdir(), "ktu-bot-attachments");

async function ensureTempDir(): Promise<string> {
  await mkdir(ATTACHMENT_TEMP_DIR, { recursive: true });
  return ATTACHMENT_TEMP_DIR;
}

function base64ToBuffer(base64Data: string): Buffer {
  return Buffer.from(base64Data, "base64");
}

async function createTempFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const tempDir = await ensureTempDir();
  const tempFilePath = join(tempDir, `temp_${Date.now()}_${fileName}`);
  await writeFile(tempFilePath, buffer);
  return tempFilePath;
}

export async function readFileAsBuffer(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // File may already be deleted
  }
}

export interface DownloadedAttachment {
  tempFilePath: string;
  fileName: string;
  fileSizeBytes: number;
}

export async function downloadAttachmentToTempFile(
  encryptId: string,
  fileName: string,
  source: AttachmentSource = "default"
): Promise<DownloadedAttachment> {
  const base64Data =
    source === "syllabus"
      ? await fetchSyllabusAttachment({ encryptId })
      : await fetchAttachment(encryptId);

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
    base64ToBuffer(base64Data),
    `${safeEncryptId}_${fileName}`
  );

  return { tempFilePath, fileName, fileSizeBytes: decodedSize };
}

/**
 * Download an attachment and run an operation with automatic temp file cleanup.
 * The temp file is always deleted, even if the operation throws.
 */
export async function cleanupDownloadedAttachment(
  downloaded: DownloadedAttachment
): Promise<void> {
  await cleanupTempFile(downloaded.tempFilePath);
}

export async function withDownloadedAttachment<T>(
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
  try {
    return await operation(downloaded);
  } finally {
    await cleanupDownloadedAttachment(downloaded);
  }
}
