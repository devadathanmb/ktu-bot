import type { Job, Queue } from "bullmq";
import { GrammyError, InputFile, type Bot } from "grammy";
import type { AttachmentDeliveryJob } from "./queue.js";
import { Attachment } from "../../types/service.types.js";
import type { BotContext } from "../../types/bot.types.js";
import {
  cleanupDownloadedAttachment,
  downloadAttachmentToTempFile,
  TELEGRAM_MAX_FILE_SIZE_BYTES,
  type DownloadedAttachment,
} from "../../utils/attachment-download.js";
import logger from "../../utils/logger.js";
import { emoji } from "@grammyjs/emoji";
import {
  combineFailures,
  splitCombinedFailure,
} from "../../errors/combine-failures.js";
import { handleWorkerGrammyError } from "../shared/utils/telegram-error-utils.js";
import { sendAsLink } from "../shared/utils/attachment-delivery.js";
import {
  createViewAnotherKeyboard,
  getContextEmoji,
} from "../../bot/utils/presentation.js";
import { buildReplyParameters } from "../shared/utils/telegram-send.js";

export interface AttachmentDeliveryDeps {
  downloadAttachment: typeof downloadAttachmentToTempFile;
  cleanupAttachment: typeof cleanupDownloadedAttachment;
  sendOversizedAsLink: typeof sendAsLink;
  handleGrammyError: typeof handleWorkerGrammyError;
}

export class AttachmentDeliveryProcessor {
  private readonly downloadAttachment: typeof downloadAttachmentToTempFile;
  private readonly cleanupAttachment: typeof cleanupDownloadedAttachment;
  private readonly sendOversizedAsLink: typeof sendAsLink;
  private readonly handleGrammyError: typeof handleWorkerGrammyError;

  constructor(
    private readonly bot: Bot<BotContext>,
    private readonly queue: Queue<AttachmentDeliveryJob>,
    deps: AttachmentDeliveryDeps
  ) {
    this.downloadAttachment = deps.downloadAttachment;
    this.cleanupAttachment = deps.cleanupAttachment;
    this.sendOversizedAsLink = deps.sendOversizedAsLink;
    this.handleGrammyError = deps.handleGrammyError;
  }

  async process(job: Job<AttachmentDeliveryJob>): Promise<void> {
    try {
      await this.processAttachmentDeliveryJob(job);
    } catch (error) {
      const { primary, additional } = splitCombinedFailure(error);

      if (!(primary instanceof GrammyError)) {
        throw error;
      }

      let recoveryError: unknown;
      let recoveryFailed = false;
      try {
        await this.handleGrammyError(job.data.chatId, primary, this.queue);
      } catch (thrown) {
        recoveryError = thrown;
        recoveryFailed = true;
      }

      if (!recoveryFailed) {
        if (additional.length > 0) {
          // Recovery handled the Telegram failure, but the cleanup failures
          // are still unhandled and must stay observable.
          throw new AggregateError(
            additional,
            "Temp file cleanup failed after handling a Telegram error"
          );
        }
        return;
      }

      if (recoveryError === primary) {
        // Normal unhandled/rate-limited rethrow: keep the original failure,
        // including any cleanup aggregate.
        throw error;
      }

      if (additional.length === 0) {
        // A distinct recovery failure replaces a lone GrammyError, as before.
        throw recoveryError;
      }

      // Expose the Telegram failure, every cleanup failure, and the recovery
      // failure in one deterministic aggregate.
      throw new AggregateError(
        [primary, ...additional, recoveryError],
        "Telegram error recovery failed after attachment delivery and cleanup failures",
        { cause: primary }
      );
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

    const downloadedAttachments: DownloadedAttachment[] = [];
    let processingFailed = false;
    let processingError: unknown;

    try {
      // Download every attachment before sending anything. Telegram sends are not
      // transactional, but this prevents partial deliveries caused by a later KTU
      // download failure after earlier files were already sent.
      for (const attachment of attachments) {
        const downloaded = await this.downloadAttachment(
          attachment.encryptId,
          attachment.name,
          attachment.source ?? "default"
        );
        downloadedAttachments.push(downloaded);
      }

      for (const [index, downloaded] of downloadedAttachments.entries()) {
        await this.sendDownloadedAttachment({
          chatId,
          downloaded,
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
      processingFailed = true;
      processingError = error;
      if (statusMessageId !== undefined) {
        await this.updateErrorMessage(chatId, statusMessageId);
      }
    }

    const cleanupErrors = await this.cleanupAllDownloadedAttachments(
      downloadedAttachments
    );

    if (processingFailed) {
      throw combineFailures(
        "Attachment delivery failed and temp file cleanup failed",
        processingError,
        cleanupErrors
      );
    }

    if (cleanupErrors.length > 0) {
      throw combineFailures(
        "Temp file cleanup failed",
        cleanupErrors[0],
        cleanupErrors.slice(1)
      );
    }
  }

  /**
   * Attempt every cleanup so one failure cannot hide the others, and return
   * failures in attachment order for deterministic aggregation.
   */
  private async cleanupAllDownloadedAttachments(
    downloadedAttachments: readonly DownloadedAttachment[]
  ): Promise<unknown[]> {
    const results = await Promise.allSettled(
      downloadedAttachments.map(downloaded =>
        this.cleanupAttachment(downloaded)
      )
    );

    const failures: unknown[] = [];
    for (const result of results) {
      if (result.status === "rejected") {
        failures.push(result.reason);
      }
    }

    return failures;
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
      await this.sendOversizedAsLink(this.bot, chatId, downloaded, {
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

    await this.bot.api.sendDocument(chatId, inputFile, {
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
    await this.bot.api.sendMessage(
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
      await this.bot.api.deleteMessage(chatId, messageId);
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
      await this.bot.api.editMessageText(
        chatId,
        messageId,
        `${emoji("crying_cat")} Oops! Something went wrong. Please try again.`
      );
    } catch (error) {
      logger.warn(
        { err: error, chatId, messageId },
        "Failed to update status message"
      );
    }
  }
}
