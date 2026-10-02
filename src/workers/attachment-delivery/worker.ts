import type { Job, Queue } from "bullmq";
import { GrammyError, InputFile, type Bot } from "grammy";
import { fmt } from "@grammyjs/parse-mode";
import { extname } from "node:path";
import type { AttachmentDeliveryJob } from "./queue.js";
import { Attachment } from "../../types/service.types.js";
import type { BotContext } from "../../types/bot.types.js";
import {
  cleanupDownloadedAttachment,
  cleanupDownloadedAttachments,
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
import { splitPdfAttachment } from "../../utils/pdf-splitter.js";
import { joinWithNewlines } from "../../utils/formatting.js";

export interface AttachmentDeliveryDeps {
  downloadAttachment: typeof downloadAttachmentToTempFile;
  cleanupAttachment: typeof cleanupDownloadedAttachment;
  splitAttachment: typeof splitPdfAttachment;
  sendOversizedAsLink: typeof sendAsLink;
  handleGrammyError: typeof handleWorkerGrammyError;
}

export class AttachmentDeliveryProcessor {
  private readonly downloadAttachment: typeof downloadAttachmentToTempFile;
  private readonly cleanupAttachment: typeof cleanupDownloadedAttachment;
  private readonly splitAttachment: typeof splitPdfAttachment;
  private readonly sendOversizedAsLink: typeof sendAsLink;
  private readonly handleGrammyError: typeof handleWorkerGrammyError;

  constructor(
    private readonly bot: Bot<BotContext>,
    private readonly queue: Queue<AttachmentDeliveryJob>,
    deps: AttachmentDeliveryDeps
  ) {
    this.downloadAttachment = deps.downloadAttachment;
    this.cleanupAttachment = deps.cleanupAttachment;
    this.splitAttachment = deps.splitAttachment;
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
    const deliveries: Array<{
      original: DownloadedAttachment;
      parts: DownloadedAttachment[];
    }> = [];
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
        let parts: DownloadedAttachment[] = [];
        if (downloaded.fileSizeBytes > TELEGRAM_MAX_FILE_SIZE_BYTES) {
          if (
            statusMessageId !== undefined &&
            extname(downloaded.fileName).toLowerCase() === ".pdf"
          ) {
            await this.updateStatusMessage(
              chatId,
              statusMessageId,
              joinWithNewlines(
                [
                  fmt`⏳ This PDF is too large to send as one file (${Math.ceil(downloaded.fileSizeBytes / 1024 ** 2)} MiB).`,
                  fmt`I’ll split it into smaller parts and send them here. Please wait…`,
                ],
                2
              ).text
            );
          }
          try {
            parts = await this.splitAttachment(downloaded);
          } catch (error) {
            // Split failures can fall back to the original link, but cleanup failures must not disappear.
            if (splitCombinedFailure(error).additional.length > 0) throw error;
            logger.warn(
              {
                err: error,
                jobId: job.id,
                chatId,
                fileName: downloaded.fileName,
              },
              "PDF splitting failed, falling back to file link"
            );
          }
        }
        if (parts.length > 0) {
          logger.info(
            {
              jobId: job.id,
              chatId,
              fileName: downloaded.fileName,
              partCount: parts.length,
            },
            "Split oversized PDF into Telegram-sized parts"
          );
        }
        downloadedAttachments.push(...parts);
        deliveries.push({ original: downloaded, parts });
      }

      for (const [index, { original, parts }] of deliveries.entries()) {
        if (parts.length > 0) {
          await this.sendPdfParts(
            chatId,
            original.fileName,
            parts,
            replyToMessageId
          );
          continue;
        }
        await this.sendDownloadedAttachment({
          chatId,
          downloaded: original,
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
        await this.updateStatusMessage(
          chatId,
          statusMessageId,
          `${emoji("crying_cat")} Oops! Something went wrong. Please try again.`
        );
      }
    }

    const cleanupErrors = await cleanupDownloadedAttachments(
      downloadedAttachments,
      this.cleanupAttachment
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

  private async sendPdfParts(
    chatId: number,
    originalName: string,
    parts: DownloadedAttachment[],
    replyToMessageId: number | undefined
  ): Promise<void> {
    const options = buildReplyParameters({
      messageIdToReplyTo: replyToMessageId,
    });
    // Telegram rejects albums when the combined upload exceeds its request limit,
    // even when every document fits individually.
    for (const [index, part] of parts.entries()) {
      const caption = joinWithNewlines(
        [fmt`📄 ${originalName}`, fmt`Part ${index + 1} of ${parts.length}`],
        2
      ).text;
      await this.bot.api.sendDocument(
        chatId,
        new InputFile(part.tempFilePath, part.fileName),
        { caption, ...options }
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
    const contextEmoji = getContextEmoji(context);
    return joinWithNewlines([
      fmt`${contextEmoji} Attachments:`,
      ...attachments.map(a => fmt`${a.name}`),
    ]).text;
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

  private async updateStatusMessage(
    chatId: number,
    messageId: number,
    text: string
  ): Promise<void> {
    try {
      await this.bot.api.editMessageText(chatId, messageId, text);
    } catch (error) {
      logger.warn(
        { err: error, chatId, messageId },
        "Failed to update status message"
      );
    }
  }
}
