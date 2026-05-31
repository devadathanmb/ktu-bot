import { Job } from "bullmq";
import { GrammyError, InputFile } from "grammy";
import { AttachmentDeliveryJob, attachmentDeliveryQueue } from "./queue.js";
import { Attachment } from "../../types/service.types.js";
import {
  cleanupDownloadedAttachment,
  downloadAttachmentToTempFile,
  TELEGRAM_MAX_FILE_SIZE_BYTES,
  type DownloadedAttachment,
} from "../../utils/file-utils.js";
import { BaseWorker } from "../base/base-worker.js";
import { createWorkerBot } from "../../bot/utils/create-worker-bot.js";
import logger from "../../utils/logger.js";
import { emoji } from "@grammyjs/emoji";
import { TelegramErrorUtils } from "../shared/utils/telegram-error-utils.js";
import { sendAsLink } from "../shared/utils/attachment-delivery.js";
import { createViewAnotherKeyboard } from "../../bot/composers/lookups/utils.js";
import { getContextEmoji } from "../../bot/composers/lookups/constants.js";
import { AttachmentDeliveryWorkerConfig } from "../../configs/attachment-delivery-worker.js";
import { buildReplyParameters } from "../shared/utils/telegram-send.js";

export class AttachmentDeliveryWorker extends BaseWorker<AttachmentDeliveryJob> {
  constructor() {
    super("attachment-delivery-worker", attachmentDeliveryQueue, {
      concurrency: 2,
      healthCheck: {
        maxFailedJobs: AttachmentDeliveryWorkerConfig.MAX_FAILED_JOBS,
        maxBacklogJobs: AttachmentDeliveryWorkerConfig.MAX_BACKLOG_JOBS,
        failedJobsLookbackMinutes:
          AttachmentDeliveryWorkerConfig.FAILED_JOBS_WINDOW_MINUTES,
      },
    });
  }

  protected override initializeWorkerSpecific(): Promise<void> {
    this.bot = createWorkerBot();
    logger.info("Bot instance created");
    return Promise.resolve();
  }

  protected override async processJob(
    job: Job<AttachmentDeliveryJob>
  ): Promise<void> {
    try {
      await this.processAttachmentDeliveryJob(job);
    } catch (error) {
      if (error instanceof GrammyError) {
        await TelegramErrorUtils.handleWorkerGrammyError(
          job.data.chatId,
          error,
          this.queue
        );
      } else {
        TelegramErrorUtils.logUnhandledGenericError(job.id, error as Error);
        throw error;
      }
    }
  }

  private async processAttachmentDeliveryJob(
    job: Job<AttachmentDeliveryJob>
  ): Promise<void> {
    const { chatId, attachments, statusMessageId, replyToMessageId, context } =
      job.data;

    logger.info(
      { jobId: job.id, chatId, context, attachmentCount: attachments.length },
      "Processing attachment delivery job"
    );

    const downloadedAttachments: Array<{
      attachment: Attachment;
      downloaded: DownloadedAttachment;
    }> = [];

    try {
      // Download every attachment before sending anything. Telegram sends are not
      // transactional, but this prevents partial deliveries caused by a later KTU
      // download failure after earlier files were already sent.
      for (const attachment of attachments) {
        const downloaded = await downloadAttachmentToTempFile(
          attachment.encryptId,
          attachment.name,
          attachment.source ?? "default"
        );
        downloadedAttachments.push({ attachment, downloaded });
      }

      for (const [index, item] of downloadedAttachments.entries()) {
        await this.sendDownloadedAttachment({
          chatId,
          downloaded: item.downloaded,
          attachments,
          context,
          replyToMessageId,
          includeCaption: index === 0,
        });
      }

      if (statusMessageId !== undefined) {
        await this.deleteStatusMessage(chatId, statusMessageId);
      }

      if (job.data.sendViewAnotherMessage) {
        await this.sendViewAnotherMessage(chatId, context);
      }

      logger.info(
        { jobId: job.id, chatId, context, attachmentCount: attachments.length },
        "Attachment delivery job completed"
      );
    } catch (error) {
      if (statusMessageId !== undefined) {
        await this.updateErrorMessage(chatId, statusMessageId);
      }
      throw error;
    } finally {
      await Promise.all(
        downloadedAttachments.map(({ downloaded }) =>
          cleanupDownloadedAttachment(downloaded)
        )
      );
    }
  }

  private async sendDownloadedAttachment(options: {
    chatId: number;
    downloaded: DownloadedAttachment;
    attachments: Attachment[];
    context: string;
    replyToMessageId?: number | undefined;
    includeCaption: boolean;
  }): Promise<void> {
    const {
      chatId,
      downloaded,
      attachments,
      context,
      replyToMessageId,
      includeCaption,
    } = options;

    if (downloaded.fileSizeBytes > TELEGRAM_MAX_FILE_SIZE_BYTES) {
      await sendAsLink(this.getBot(), chatId, downloaded, {
        contextLabel: getContextEmoji(context),
        replyToMessageId,
      });
      return;
    }

    const inputFile = new InputFile(
      downloaded.tempFilePath,
      downloaded.fileName
    );
    const caption = includeCaption
      ? this.buildCaption(attachments, context)
      : "";

    await this.getBot().api.sendDocument(chatId, inputFile, {
      ...(caption && { caption }),
      ...buildReplyParameters({ messageIdToReplyTo: replyToMessageId }),
    });
  }

  private buildCaption(attachments: Attachment[], context: string): string {
    if (attachments.length === 0) return "";
    const contextEmoji = getContextEmoji(context);
    return [
      `${contextEmoji} Attachments:`,
      ...attachments.map(a => a.name),
    ].join("\n");
  }

  private async sendViewAnotherMessage(
    chatId: number,
    context: string
  ): Promise<void> {
    const keyboard = createViewAnotherKeyboard(context);
    const contextEmoji = getContextEmoji(context);
    await this.getBot().api.sendMessage(
      chatId,
      `${contextEmoji} View another ${context}?`,
      { reply_markup: keyboard }
    );
  }

  private async deleteStatusMessage(
    chatId: number,
    messageId: number
  ): Promise<void> {
    try {
      await this.getBot().api.deleteMessage(chatId, messageId);
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 400) {
        // Already deleted
      } else {
        throw error;
      }
    }
  }

  private async updateErrorMessage(
    chatId: number,
    messageId: number
  ): Promise<void> {
    try {
      await this.getBot().api.editMessageText(
        chatId,
        messageId,
        `${emoji("crying_cat")} Oops! Something went wrong. Please try again.`
      );
    } catch (error) {
      logger.warn(
        { chatId, messageId, err: error as Error },
        "Failed to update status message"
      );
    }
  }
}
