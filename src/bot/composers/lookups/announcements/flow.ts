import { emoji } from "@grammyjs/emoji";
import { fmt } from "@grammyjs/parse-mode";
import { CallbackQueryContext } from "grammy";
import { BotContext } from "../../../../types/bot.types.js";
import { Announcement } from "../../../../types/service.types.js";
import { editMessageIgnoringNotModified } from "../../../../utils/bot.js";
import logger from "../../../../utils/logger.js";
import { joinWithNewlines } from "../../../../utils/formatting.js";
import type { AttachmentDeliveryJob } from "../../../../workers/attachment-delivery/queue.js";
import { createViewAnotherKeyboard } from "../../../utils/presentation.js";
import { announcementsCommandInfo } from "../command-info.js";
import { LOOKUP_CONFIG } from "../constants.js";
import {
  fetchAndRenderApiPage,
  findItemById,
  handleApiNextPage,
  handleApiPreviousPage,
  parseSelectCallback,
  startApiPaginatedLookup,
  storeCallbackMessageId,
} from "../utils.js";
import {
  formatAnnouncementDetails,
  generateAnnouncementsKeyboard,
  generateAnnouncementsText,
} from "./views.js";

const MESSAGES = {
  FETCHING_ANNOUNCEMENTS: [
    fmt`${emoji("hourglass_not_done")} Fetching announcements... Please wait...`,
  ],
};

type CallbackContext = CallbackQueryContext<BotContext>;

// Every dependency is required: the composer wires the live KTU fetcher and
// the attachment-delivery queue exactly once, and the flow closes over them.
export interface AnnouncementsFlowDeps {
  fetchAnnouncements: (params: {
    pageNumber: number;
    dataSize: number;
  }) => Promise<Announcement[]>;
  queueDownload: (job: AttachmentDeliveryJob) => Promise<unknown>;
}

export interface AnnouncementsFlow {
  start(ctx: BotContext): Promise<void>;
  select(ctx: CallbackContext): Promise<void>;
  viewAnother(ctx: CallbackContext): Promise<void>;
  end(ctx: CallbackContext): Promise<void>;
  previousPage(ctx: CallbackContext): Promise<void>;
  nextPage(ctx: CallbackContext): Promise<void>;
}

export function createAnnouncementsFlow(
  deps: AnnouncementsFlowDeps
): AnnouncementsFlow {
  function createLookupConfig() {
    return {
      messageIdSessionKey: "announcementsMessageId" as const,
      getPage: (ctx: BotContext) => ctx.session.announcementsPage,
      setPage: (ctx: BotContext, page: number | null) => {
        ctx.session.announcementsPage = page;
      },
      getItems: (ctx: BotContext) => ctx.session.announcementsAnnouncements,
      setItems: (ctx: BotContext, announcements: Announcement[]) => {
        ctx.session.announcementsAnnouncements = announcements;
      },
      fetchPage: (pageNumber: number) =>
        deps.fetchAnnouncements({
          pageNumber,
          dataSize: LOOKUP_CONFIG.PAGE_SIZE,
        }),
      buildKeyboard: generateAnnouncementsKeyboard,
      buildText: generateAnnouncementsText,
      loadingMessage: joinWithNewlines(MESSAGES.FETCHING_ANNOUNCEMENTS, 2),
    };
  }

  async function fetchAndDisplay(ctx: BotContext): Promise<void> {
    await fetchAndRenderApiPage(ctx, createLookupConfig());
  }

  async function handleSelection(
    ctx: BotContext,
    announcement: Announcement
  ): Promise<void> {
    const detailsMsg = formatAnnouncementDetails(announcement);
    await ctx.editMessageText(detailsMsg.text, {
      entities: detailsMsg.entities,
    });
  }

  async function handleAttachments(
    ctx: BotContext,
    announcement: Announcement
  ): Promise<void> {
    const attachments = announcement.attachments || [];
    const keyboard = createViewAnotherKeyboard("announcement");

    if (attachments.length === 0) {
      await ctx.reply(`${emoji("eyes")} View another announcement?`, {
        reply_markup: keyboard,
      });
      return;
    }

    const plural = attachments.length > 1 ? "s" : "";
    const statusMessage = await ctx.reply(
      `${emoji("hourglass_not_done")} Downloading your file${plural} in the background... This may take a moment!`
    );

    const jobData: AttachmentDeliveryJob = {
      chatId: ctx.chat!.id,
      attachments,
      statusMessageId: statusMessage.message_id,
      context: "announcement",
      sendViewAnotherMessage: true,
    };

    if (ctx.msgId !== undefined) {
      jobData.replyToMessageId = ctx.msgId;
    }

    await deps.queueDownload(jobData);
  }

  async function start(ctx: BotContext): Promise<void> {
    if (ctx.session.announcementsPage === null) {
      ctx.session.announcementsPage = LOOKUP_CONFIG.INITIAL_PAGE;
    }

    const formattedMsg = joinWithNewlines(MESSAGES.FETCHING_ANNOUNCEMENTS, 2);
    const loadingMessage = await ctx.reply(formattedMsg.text, {
      entities: formattedMsg.entities,
    });
    ctx.session.announcementsMessageId = loadingMessage.message_id;

    await startApiPaginatedLookup(
      ctx,
      createLookupConfig(),
      loadingMessage.message_id
    );
  }

  async function select(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();

    const parsed = parseSelectCallback(ctx.callbackQuery.data, "announcement");
    if (!parsed.isValid) {
      await editMessageIgnoringNotModified(() =>
        ctx.editMessageText(
          `${emoji("cross_mark")} Invalid callback format. Please try again.`
        )
      );
      return;
    }

    storeCallbackMessageId(ctx, "announcementsMessageId");

    const announcement = findItemById(
      ctx.session.announcementsAnnouncements,
      parsed.id
    );

    // The successful render replaces the selection buttons, so a repeated
    // selection callback is a duplicate tap rather than a new choice.
    const selectionChanged = await editMessageIgnoringNotModified(() =>
      handleSelection(ctx, announcement)
    );
    if (!selectionChanged) {
      logger.debug(
        { chatId: ctx.chat?.id, userId: ctx.from?.id },
        "Ignoring duplicate announcement selection"
      );
      return;
    }
    await handleAttachments(ctx, announcement);
  }

  async function viewAnother(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();

    ctx.session.announcementsPage = LOOKUP_CONFIG.INITIAL_PAGE;
    await fetchAndDisplay(ctx);
  }

  async function end(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();

    await editMessageIgnoringNotModified(() =>
      ctx.editMessageText(
        `Announcements lookup ended. Use /${announcementsCommandInfo.name} to start again.`
      )
    );

    ctx.session.announcementsPage = null;
    ctx.session.announcementsAnnouncements = [];
    ctx.session.announcementsMessageId = null;
  }

  async function previousPage(ctx: CallbackContext): Promise<void> {
    await handleApiPreviousPage(ctx, createLookupConfig());
  }

  async function nextPage(ctx: CallbackContext): Promise<void> {
    await handleApiNextPage(ctx, createLookupConfig());
  }

  return { start, select, viewAnother, end, previousPage, nextPage };
}
