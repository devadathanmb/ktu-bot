import { createBot } from "../../../bot/bot.js";
import { Bot } from "grammy";
import { BotContext } from "../../../types/bot.types.js";
import { Attachment } from "../../../types/service.types.js";
import {
  createGrammyInputFileFromAttachment,
  createTempFileFromBase64,
} from "../../../utils/fileUtils.js";
import { FormattedString } from "@grammyjs/parse-mode";
import { ProcessedAttachment } from "../../shared/types.js";
import { BotConfig } from "../../../configs/bot.js";
import { autoRetry } from "@grammyjs/auto-retry";
import {
  fetchAttachment,
  uploadTempFile,
} from "../../../api/services/index.js";
import logger from "../../../utils/logger.js";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { Job } from "bullmq";

// Generic type for notifier with separate job data and message data types
export abstract class BaseNotifier<
  TJobData = Record<string, unknown>,
  TMessageData = Record<string, unknown>,
> {
  protected bot!: Bot<BotContext>;

  protected initBot() {
    const bot = createBot();

    // Add throttling and auto-retry middleware
    // This is to avoid rate limits while uploading files
    // Throttler will try to keep us within limits but if we exceed
    // Auto-retry will retry the failed requests
    bot.api.config.use(apiThrottler());
    bot.api.config.use(
      autoRetry({
        maxRetryAttempts: 5,
      })
    );

    this.bot = bot;
    logger.info(`Bot instance created for ${this.constructor.name}`);
  }

  /**
   * Prepare formatted message from data
   * Child classes must implement this method
   */
  protected abstract prepareFormattedMessage(
    data: TMessageData
  ): FormattedString;

  /**
   * Process notification job
   * Child classes must implement this method
   */
  protected abstract processJob(job: Job<TJobData>): Promise<void>;

  /**
   * Wrapper for processing jobs with error handling
   */
  protected async processJobWrapper(job: Job<TJobData>) {
    try {
      await this.processJob(job);
    } catch (error) {
      logger.error(
        { jobId: job.id, error },
        "Notification job failed in wrapper"
      );
      throw error;
    }
  }

  /**
   * Upload file to file hosting service and return URL
   */
  private async uploadFileToFileHosting(
    _attachment: Attachment
  ): Promise<string> {
    const base64FileData = await fetchAttachment(_attachment.encryptId);
    const tempFilePath = await createTempFileFromBase64(
      base64FileData,
      _attachment.name
    );
    const fileUrl = await uploadTempFile({
      filePath: tempFilePath,
      fileName: _attachment.name,
    });
    return fileUrl;
  }

  /**
   * Upload file to Telegram and return file ID
   */
  private async uploadFileToTelegram(attachment: Attachment): Promise<string> {
    try {
      logger.debug({ fileName: attachment.name }, "Uploading file to Telegram");
      const inputFile = await createGrammyInputFileFromAttachment(
        attachment.encryptId,
        attachment.name
      );

      // Upload to a file storage channel or use getFile to get file_id
      const message = await this.bot.api.sendDocument(
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
   */
  protected async processAttachments(
    attachments: Attachment[]
  ): Promise<ProcessedAttachment[]> {
    const processedAttachments: ProcessedAttachment[] = [];

    for (const attachment of attachments) {
      let processed: ProcessedAttachment | null = null;

      // Try uploading this to telegram first and get the file ID
      // File IDs can be reused as many times as required
      try {
        const fileId = await this.uploadFileToTelegram(attachment);
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
      if (!processed) {
        try {
          logger.debug(
            { fileName: attachment.name },
            "Uploading file to file hosting service"
          );
          const fileUrl = await this.uploadFileToFileHosting(attachment);
          processed = {
            fileName: attachment.name,
            fileUrl,
          };
        } catch (error) {
          logger.error(
            { fileName: attachment.name, error: error },
            "Failed to upload to file hosting. Skipping this attachment."
          );
        }
      }

      if (processed) {
        processedAttachments.push(processed);
      }
    }

    return processedAttachments;
  }
}
