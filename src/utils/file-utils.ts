import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { randomUUID } from "node:crypto";
import { basename, join } from "path";
import { tmpdir } from "os";

const ATTACHMENT_TEMP_DIR = join(tmpdir(), "ktu-bot-attachments");
const FALLBACK_FILE_NAME = "attachment";

async function ensureTempDir(): Promise<string> {
  await mkdir(ATTACHMENT_TEMP_DIR, { recursive: true });
  return ATTACHMENT_TEMP_DIR;
}

/**
 * Reduce an untrusted attachment name to a single safe path segment: drop any
 * directory components, replace characters the filesystem should not see, and
 * fall back to a generic name when nothing usable remains.
 */
function sanitizeFileName(fileName: string): string {
  const baseName = basename(fileName)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "");
  return baseName || FALLBACK_FILE_NAME;
}

export async function createTempFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const tempDir = await ensureTempDir();
  const tempFilePath = join(
    tempDir,
    `temp_${randomUUID()}_${sanitizeFileName(fileName)}`
  );
  await writeFile(tempFilePath, buffer);
  return tempFilePath;
}

export async function readFileAsBuffer(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    // A missing file means it was already cleaned up; anything else is a real
    // failure the caller must see.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
}
