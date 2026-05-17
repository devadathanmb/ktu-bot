import { Bot, InputFile } from "grammy";
import { BotContext } from "../../../types/bot.types.js";
import type { DownloadedAttachment } from "../../../utils/file-utils.js";
import { BotConfig } from "../../../configs/bot.js";
import { uploadTempFile } from "../../../api/services/index.js";
import logger from "../../../utils/logger.js";

export async function uploadToFileChannel(
  bot: Bot<BotContext>,
  downloaded: DownloadedAttachment
): Promise<string> {
  const inputFile = new InputFile(downloaded.tempFilePath, downloaded.fileName);

  const message = await bot.api.sendDocument(
    BotConfig.BOT_FILE_UPLOAD_CHANNEL_ID,
    inputFile
  );

  const fileId = message.document?.file_id ?? "";
  logger.debug(
    { fileName: downloaded.fileName, fileId },
    "Uploaded attachment to Telegram file channel"
  );
  return fileId;
}

export async function uploadToFileHost(
  downloaded: DownloadedAttachment
): Promise<string> {
  const fileUrl = await uploadTempFile({
    filePath: downloaded.tempFilePath,
    fileName: downloaded.fileName,
  });

  logger.info(
    { fileName: downloaded.fileName, fileUrl },
    "Attachment uploaded to file host"
  );

  return fileUrl;
}

export async function sendAsLink(
  bot: Bot<BotContext>,
  chatId: number,
  downloaded: DownloadedAttachment,
  options?: {
    contextLabel?: string | undefined;
    replyToMessageId?: number | undefined;
  }
): Promise<string> {
  const fileUrl = await uploadToFileHost(downloaded);

  const sizeMB = (downloaded.fileSizeBytes / (1024 * 1024)).toFixed(1);
  const label = options?.contextLabel ? `${options.contextLabel} ` : "";
  const message = `${label}${downloaded.fileName} (${sizeMB} MB)\n\n🔗 Download: ${fileUrl}`;

  const sendOptions: Parameters<typeof bot.api.sendMessage>[2] = {};

  if (options?.replyToMessageId !== undefined) {
    sendOptions.reply_parameters = {
      message_id: options.replyToMessageId,
      allow_sending_without_reply: true,
    };
  }

  await bot.api.sendMessage(chatId, message, sendOptions);
  return fileUrl;
}
