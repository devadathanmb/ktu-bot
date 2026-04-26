import { readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { InputFile } from "grammy";
import {
  fetchAttachment,
  fetchSyllabusAttachment,
} from "../api/services/index.js";
import type { AttachmentSource } from "../types/service.types.js";
import logger from "../utils/logger.js";

/**
 * Convert base64 string to Buffer
 */
export function base64ToBuffer(base64Data: string): Buffer {
  return Buffer.from(base64Data, "base64");
}

/**
 * Create a temporary file from buffer data
 * @param buffer - File data as Buffer
 * @param fileName - Original filename
 * @returns Absolute path to the temporary file
 */
export async function createTempFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const tempFilePath = join(tmpdir(), `temp_${Date.now()}_${fileName}`);
  await writeFile(tempFilePath, buffer);
  return tempFilePath;
}

/**
 * Create a temporary file from base64 data
 * @param base64Data - File data as base64 string
 * @param fileName - Original filename
 * @returns Absolute path to the temporary file
 */
export async function createTempFileFromBase64(
  base64Data: string,
  fileName: string
): Promise<string> {
  const buffer = base64ToBuffer(base64Data);
  return createTempFile(buffer, fileName);
}

/**
 * Read a file and return its buffer
 * @param filePath - Absolute path to the file
 * @returns File content as Buffer
 */
export async function readFileAsBuffer(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

/**
 * Clean up a temporary file (ignore errors)
 * @param filePath - Absolute path to the file to delete
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // Ignore cleanup errors - file might already be deleted
  }
}

/**
 * Execute a function with automatic temp file cleanup
 * @param tempFilePath - Path to temp file to clean up
 * @param operation - Function to execute
 * @returns Result of the operation
 */
export async function withTempFileCleanup<T>(
  tempFilePath: string,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } finally {
    await cleanupTempFile(tempFilePath);
  }
}

/**
 * Fetch attachment data by encryptId and create a Grammy InputFile
 * @param encryptId - The encrypted ID of the attachment
 * @param fileName - The filename to assign to the InputFile
 * @param source - Attachment source ("default" for regular, "syllabus" for syllabus attachments)
 * @returns Grammy InputFile ready for sending
 */
export async function createGrammyInputFileFromAttachment(
  encryptId: string,
  fileName: string,
  source: AttachmentSource = "default"
): Promise<InputFile> {
  const base64Data =
    source === "syllabus"
      ? await fetchSyllabusAttachment(encryptId)
      : await fetchAttachment(encryptId);
  const buffer = base64ToBuffer(base64Data);

  logger.info(
    { fileName, source, fileSizeBytes: buffer.length },
    "Attachment downloaded"
  );

  return new InputFile(buffer, fileName);
}
