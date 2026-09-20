import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const ATTACHMENT_TEMP_DIR = join(tmpdir(), "ktu-bot-attachments");

async function ensureTempDir(): Promise<string> {
  await mkdir(ATTACHMENT_TEMP_DIR, { recursive: true });
  return ATTACHMENT_TEMP_DIR;
}

export async function createTempFile(
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

export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // File may already be deleted
  }
}
