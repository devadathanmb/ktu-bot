import { Bot } from "grammy";
import { BotContext } from "../../../types/bot.types.js";
import { Attachment } from "../../../types/service.types.js";
import { ProcessedAttachment } from "../types.js";
import {
  withDownloadedAttachment,
  TELEGRAM_MAX_FILE_SIZE_BYTES,
} from "../../../utils/file-utils.js";
import {
  uploadToFileChannel,
  uploadToFileHost,
} from "./attachment-delivery.js";
import logger from "../../../utils/logger.js";

export async function processAttachments(
  bot: Bot<BotContext>,
  attachments: Attachment[]
): Promise<ProcessedAttachment[]> {
  const results: ProcessedAttachment[] = [];

  for (const attachment of attachments) {
    const processed = await withDownloadedAttachment(
      attachment.encryptId,
      attachment.name,
      attachment.source ?? "default",
      downloaded => processSingleAttachment(bot, downloaded)
    );
    results.push(processed);
  }

  return results;
}

async function processSingleAttachment(
  bot: Bot<BotContext>,
  downloaded: { fileName: string; tempFilePath: string; fileSizeBytes: number }
): Promise<ProcessedAttachment> {
  const { fileName } = downloaded;

  if (downloaded.fileSizeBytes > TELEGRAM_MAX_FILE_SIZE_BYTES) {
    const sizeMB = (downloaded.fileSizeBytes / (1024 * 1024)).toFixed(1);
    logger.info(
      { fileName, sizeMB },
      "Attachment exceeds Telegram upload limit, uploading to file host"
    );
    const fileUrl = await uploadToFileHost(downloaded);
    return { fileName, fileUrl };
  }

  try {
    const fileId = await uploadToFileChannel(bot, downloaded);
    if (fileId) return { fileName, fileId };
  } catch (error) {
    logger.warn(
      { fileName, error },
      `Failed to upload ${fileName} to Telegram, falling back to file host`
    );
  }

  const fileUrl = await uploadToFileHost(downloaded);
  return { fileName, fileUrl };
}
