import { Job } from "bullmq";
import { GrammyError, InputMediaBuilder, InputFile } from "grammy";
import { AttachmentDeliveryJob, attachmentDeliveryQueue } from "./queue.js";
import { Attachment } from "../../types/service.types.js";
import { createGrammyInputFileFromAttachment } from "../../utils/file-utils.js";
import { BaseWorker } from "../base/base-worker.js";
import { createWorkerBot } from "../../bot/utils/create-worker-bot.js";
import logger from "../../utils/logger.js";
import { emoji } from "@grammyjs/emoji";
import { TelegramErrorUtils } from "../shared/utils/telegram-error-utils.js";
import { createViewAnotherKeyboard } from "../../bot/composers/lookups/utils.js";
import { getContextEmoji } from "../../bot/composers/lookups/constants.js";

export class AttachmentDeliveryWorker extends BaseWorker<AttachmentDeliveryJob> {
  constructor() {
    super("attachment-delivery-worker", attachmentDeliveryQueue, {
      concurrency: 2,
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
      }
    }
  }

  private async processAttachmentDeliveryJob(
    job: Job<AttachmentDeliveryJob>
  ): Promise<void> {
    const { chatId, attachments, statusMessageId, replyToMessageId, context } =
      job.data;

    const downloadedFiles: Array<{
      inputFile: InputFile;
      attachment: Attachment;
    }> = [];

    try {
      for (const attachment of attachments) {
        const inputFile = await createGrammyInputFileFromAttachment(
          attachment.encryptId,
          attachment.name
        );
        downloadedFiles.push({ inputFile, attachment });
      }

      const caption = this.buildCaption(attachments, context);

      const batchSize = 10;
      for (let i = 0; i < downloadedFiles.length; i += batchSize) {
        const batch = downloadedFiles.slice(i, i + batchSize);
        const firstInBatch = i === 0;

        const mediaGroup = batch.map((item, index) => {
          const params: Record<string, unknown> = {};
          if (firstInBatch && index === 0 && caption) {
            params.caption = caption;
          }

          return InputMediaBuilder.document(item.inputFile, params);
        });

        const replyParams = replyToMessageId
          ? {
              reply_parameters: {
                message_id: replyToMessageId,
                allow_sending_without_reply: true,
              },
            }
          : undefined;

        await this.getBot().api.sendMediaGroup(chatId, mediaGroup, replyParams);
      }

      if (statusMessageId !== undefined) {
        await this.deleteStatusMessage(chatId, statusMessageId);
      }

      if (job.data.sendViewAnotherMessage) {
        await this.sendViewAnotherMessage(job.data.chatId, job.data.context);
      }
    } catch (error) {
      if (statusMessageId !== undefined) {
        await this.updateErrorMessage(chatId, statusMessageId);
      }
      throw error;
    }
  }

  private buildCaption(attachments: Attachment[], context: string): string {
    if (attachments.length === 0) return "";

    const contextEmoji = getContextEmoji(context);
    const lines = [
      `${contextEmoji} Attachments:`,
      ...attachments.map(a => a.name),
    ];

    return lines.join("\n");
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
    logger.debug({ chatId, context }, "Sent view another message");
  }

  private async deleteStatusMessage(
    chatId: number,
    messageId: number
  ): Promise<void> {
    try {
      await this.getBot().api.deleteMessage(chatId, messageId);
      logger.debug({ chatId, messageId }, "Deleted status message");
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 400) {
        logger.debug(
          { chatId, messageId },
          "Status message already deleted, ignoring"
        );
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
      if (error instanceof GrammyError && error.error_code === 400) {
        logger.debug(
          { chatId, messageId },
          "Status message deleted by user, skipping error update"
        );
      } else {
        throw error;
      }
    }
  }
}
