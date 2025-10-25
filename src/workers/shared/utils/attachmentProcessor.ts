import { Bot } from "grammy";
import { BotContext } from "../../../types/bot.types.js";
import { Attachment } from "../../../types/service.types.js";
import { ProcessedAttachment } from "../types.js";
import {
  createGrammyInputFileFromAttachment,
  createTempFileFromBase64,
} from "../../../utils/fileUtils.js";
import {
  fetchAttachment,
  uploadTempFile,
} from "../../../api/services/index.js";
import { BotConfig } from "../../../configs/bot.js";
import logger from "../../../utils/logger.js";

/**
 * Upload file to file hosting service and return URL
 */
export async function uploadFileToFileHosting(
  attachment: Attachment
): Promise<string> {
  const base64FileData = await fetchAttachment(attachment.encryptId);
  const tempFilePath = await createTempFileFromBase64(
    base64FileData,
    attachment.name
  );
  const fileUrl = await uploadTempFile({
    filePath: tempFilePath,
    fileName: attachment.name,
  });
  return fileUrl;
}

/**
 * Upload file to Telegram and return file ID
 */
export async function uploadFileToTelegram(
  bot: Bot<BotContext>,
  attachment: Attachment
): Promise<string> {
  try {
    logger.debug({ fileName: attachment.name }, "Uploading file to Telegram");
    const inputFile = await createGrammyInputFileFromAttachment(
      attachment.encryptId,
      attachment.name
    );

    // Upload to a file storage channel or use getFile to get file_id
    const message = await bot.api.sendDocument(
      BotConfig.BOT_FILE_UPLOAD_CHANNEL_ID,
      inputFile
    );

    logger.debug(
      { fileId: message.document?.file_id },
      "Successfully uploaded file to Telegram"
    );
    return message.document?.file_id || "";
  } catch (error) {
    logger.error(
      { fileName: attachment.name, error: error },
      "Failed to upload file to Telegram"
    );
    throw error;
  }
}

/**
 * Process attachments and return processed attachment info
 * Tries to upload to Telegram first (for file_id), falls back to file hosting (for URL)
 */
export async function processAttachments(
  bot: Bot<BotContext>,
  attachments: Attachment[]
): Promise<ProcessedAttachment[]> {
  const processedAttachments: ProcessedAttachment[] = [];

  for (const attachment of attachments) {
    let processed: ProcessedAttachment | null = null;

    // Try uploading this to telegram first and get the file ID
    // File IDs can be reused as many times as required
    try {
      const fileId = await uploadFileToTelegram(bot, attachment);
      processed = {
        fileName: attachment.name,
        fileId,
      };
    } catch (error) {
      logger.warn(
        { fileName: attachment.name, error: error },
        `Failed to upload file ${attachment.name} to Telegram, trying file hosting service`
      );
    }

    // If Telegram upload failed, fallback to file hosting and get URL
    // If file hosting upload fails, throw error to fail the entire job
    if (!processed) {
      try {
        logger.debug(
          { fileName: attachment.name },
          "Uploading file to file hosting service"
        );
        const fileUrl = await uploadFileToFileHosting(attachment);
        processed = {
          fileName: attachment.name,
          fileUrl,
        };
      } catch (error) {
        logger.error(
          { fileName: attachment.name, error: error },
          "Failed to upload to file hosting."
        );
        throw error;
      }
    }

    if (processed) {
      processedAttachments.push(processed);
    }
  }

  return processedAttachments;
}
