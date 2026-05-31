import { BotContext } from "../../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer, InlineKeyboard } from "grammy";
import { Announcement } from "../../../../types/service.types.js";
import {
  generatePaginatedKeyboard,
  generatePaginatedMessageText,
  parseSelectCallback,
  createViewAnotherKeyboard,
  findItemById,
  fetchAndRenderApiPage,
  handleApiNextPage,
  handleApiPreviousPage,
  startApiPaginatedLookup,
  storeCallbackMessageId,
} from "../utils.js";
import { LOOKUP_CONFIG } from "../constants.js";
import { FormattedString, fmt, b } from "@grammyjs/parse-mode";
import {
  joinWithNewlines,
  formatCommand,
} from "../../../../utils/formatting.js";
import { createAnnouncementsErrorBoundary } from "../../shared/error-boundary.js";
import { emoji } from "@grammyjs/emoji";
import { fetchAnnouncements } from "../../../../api/services/index.js";
import { addAttachmentDeliveryJob } from "../../../../workers/attachment-delivery/queue.js";

const MESSAGES = {
  FETCHING_ANNOUNCEMENTS: [
    fmt`${emoji("hourglass_not_done")} Fetching announcements... Please wait...`,
  ],
  FETCHING_DETAILS: [
    fmt`${emoji("hourglass_not_done")} Fetching announcement details... Please wait...`,
  ],
};

function generateAnnouncementsKeyboard(
  announcements: Announcement[],
  currentPage: number
): InlineKeyboard {
  return generatePaginatedKeyboard(announcements, currentPage, "announcement");
}

function generateAnnouncementsText(
  announcements: Announcement[]
): FormattedString {
  return generatePaginatedMessageText(
    announcements,
    `${emoji("loudspeaker")} Announcements`,
    "announcement"
  );
}

function formatAnnouncementDetails(
  announcement: Announcement
): FormattedString {
  const parts: FormattedString[] = [];

  if (announcement.subject) {
    parts.push(
      joinWithNewlines([
        fmt`${b}${emoji("open_book")} Subject:${b}`,
        fmt`${announcement.subject}`,
      ])
    );
  }
  if (announcement.message) {
    parts.push(
      joinWithNewlines([
        fmt`${b}${emoji("memo")} Message:${b}`,
        fmt`${announcement.message}`,
      ])
    );
  }
  if (announcement.formattedPublishedDate) {
    parts.push(
      fmt`${b}${emoji("calendar")} Date:${b} ${announcement.formattedPublishedDate}`
    );
  }

  return joinWithNewlines(parts, 2);
}

async function handleAnnouncementSelection(
  ctx: BotContext,
  announcement: Announcement
): Promise<void> {
  const loadingMsg = joinWithNewlines(MESSAGES.FETCHING_DETAILS, 2);
  await ctx.editMessageText(loadingMsg.text, {
    entities: loadingMsg.entities,
  });

  const detailsMsg = formatAnnouncementDetails(announcement);
  await ctx.editMessageText(detailsMsg.text, {
    entities: detailsMsg.entities,
  });
}

async function handleAnnouncementAttachments(
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

  const jobData: Parameters<typeof addAttachmentDeliveryJob>[0] = {
    chatId: ctx.chat!.id,
    attachments,
    statusMessageId: statusMessage.message_id,
    context: "announcement",
    sendViewAnotherMessage: true,
  };

  if (ctx.msgId !== undefined) {
    jobData.replyToMessageId = ctx.msgId;
  }

  await addAttachmentDeliveryJob(jobData);
}

function createAnnouncementsLookupConfig() {
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
      fetchAnnouncements({
        pageNumber,
        dataSize: LOOKUP_CONFIG.PAGE_SIZE,
      }),
    buildKeyboard: generateAnnouncementsKeyboard,
    buildText: generateAnnouncementsText,
    loadingMessage: joinWithNewlines(MESSAGES.FETCHING_ANNOUNCEMENTS, 2),
  };
}

async function fetchAndDisplayAnnouncements(ctx: BotContext): Promise<void> {
  await fetchAndRenderApiPage(ctx, createAnnouncementsLookupConfig());
}

const composer = new Composer<BotContext>();

const protectedComposer = composer.errorBoundary(
  createAnnouncementsErrorBoundary()
);

const announcementsLookupCommand = new Command<BotContext>(
  "announcements",
  `${emoji("loudspeaker")} Find published announcements from KTU`,
  async ctx => {
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
      createAnnouncementsLookupConfig(),
      loadingMessage.message_id
    );
  }
);

protectedComposer.callbackQuery(/^announcement_select_/, async ctx => {
  await ctx.answerCallbackQuery();

  const parsed = parseSelectCallback(ctx.callbackQuery.data, "announcement");
  if (!parsed.isValid) {
    await ctx.editMessageText(
      `${emoji("cross_mark")} Invalid callback format. Please try again.`
    );
    return;
  }

  storeCallbackMessageId(ctx, "announcementsMessageId");

  const announcement = findItemById(
    ctx.session.announcementsAnnouncements,
    parsed.id
  );

  await handleAnnouncementSelection(ctx, announcement);
  await handleAnnouncementAttachments(ctx, announcement);
});

protectedComposer.callbackQuery("announcement_view_another_true", async ctx => {
  await ctx.answerCallbackQuery();

  // Reset to first page and refetch
  ctx.session.announcementsPage = LOOKUP_CONFIG.INITIAL_PAGE;
  await fetchAndDisplayAnnouncements(ctx);
});

protectedComposer.callbackQuery(
  "announcement_view_another_false",
  async ctx => {
    await ctx.answerCallbackQuery();

    await ctx.editMessageText(
      `Announcements lookup ended. Use ${formatCommand(announcementsLookupCommand)} to start again.`
    );

    ctx.session.announcementsPage = null;
    ctx.session.announcementsAnnouncements = [];
    ctx.session.announcementsMessageId = null;
  }
);

protectedComposer.callbackQuery("announcement_page_info", async ctx => {
  await ctx.answerCallbackQuery();
});

protectedComposer.callbackQuery("announcement_prev_page", async ctx => {
  await handleApiPreviousPage(ctx, createAnnouncementsLookupConfig());
});

protectedComposer.callbackQuery("announcement_next_page", async ctx => {
  await handleApiNextPage(ctx, createAnnouncementsLookupConfig());
});

const announcementsCommands = new CommandGroup<BotContext>();

announcementsCommands.add(announcementsLookupCommand);

protectedComposer.use(announcementsCommands);

export const announcementsLookup = composer;
export { announcementsCommands, announcementsLookupCommand };
