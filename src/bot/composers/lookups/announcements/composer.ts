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
  storeCallbackMessageId,
} from "../utils.js";
import { LOOKUP_CONFIG } from "../constants.js";
import { FormattedString, fmt, b } from "@grammyjs/parse-mode";
import {
  joinWithNewlines,
  formatCommand,
} from "../../../../utils/formatting.js";
import { createAnnouncementsErrorBoundary } from "../../shared/errorBoundary.js";
import { emoji } from "@grammyjs/emoji";
import { fetchAnnouncements } from "../../../../api/services/index.js";
import { addAttachmentDeliveryJob } from "../../../../workers/attachment-delivery/index.js";

// Common messages used throughout the composer
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

// Internal helper functions

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
  // Show loading
  const loadingMsg = joinWithNewlines(MESSAGES.FETCHING_DETAILS, 2);
  await ctx.editMessageText(loadingMsg.text, {
    entities: loadingMsg.entities,
  });

  // Format and display details
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

  // Queue attachments for background delivery
  const plural = attachments.length > 1 ? "s" : "";
  const statusMessage = await ctx.reply(
    `${emoji("hourglass_not_done")} Downloading your file${plural} in the background... This may take a moment!`
  );

  const jobData: Parameters<typeof addAttachmentDeliveryJob>[0] = {
    chatId: ctx.chat!.id,
    attachments,
    statusMessageId: statusMessage.message_id,
    context: "announcement",
  };

  if (ctx.msgId !== undefined) {
    jobData.replyToMessageId = ctx.msgId;
  }

  await addAttachmentDeliveryJob(jobData);

  await ctx.reply(`${emoji("eyes")} View another announcement?`, {
    reply_markup: keyboard,
  });
}

async function fetchAndDisplayAnnouncements(ctx: BotContext): Promise<void> {
  // Store message ID for error boundary
  storeCallbackMessageId(ctx, "announcementsMessageId");

  // Show loading
  const loadingMsg = joinWithNewlines(MESSAGES.FETCHING_ANNOUNCEMENTS, 2);
  await ctx.editMessageText(loadingMsg.text, {
    entities: loadingMsg.entities,
  });

  // Fetch data
  const announcements = await fetchAnnouncements({
    pageNumber: ctx.session.announcementsPage ?? LOOKUP_CONFIG.INITIAL_PAGE,
    dataSize: LOOKUP_CONFIG.PAGE_SIZE,
  });

  // Update session and display
  ctx.session.announcementsAnnouncements = announcements;
  const keyboard = generateAnnouncementsKeyboard(
    announcements,
    ctx.session.announcementsPage ?? LOOKUP_CONFIG.INITIAL_PAGE
  );
  const messageText = generateAnnouncementsText(announcements);

  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
}

// Create a composer for announcements lookup
const composer = new Composer<BotContext>();

// Create protected composer with error boundary for loading message cleanup
const protectedComposer = composer.errorBoundary(
  createAnnouncementsErrorBoundary()
);

// Command: /announcements — Lookup announcements
const announcementsLookupCommand = new Command<BotContext>(
  "announcements",
  `${emoji("loudspeaker")} Find published announcements from KTU`,
  async ctx => {
    // Initialize session data
    if (ctx.session.announcementsPage === null) {
      ctx.session.announcementsPage = LOOKUP_CONFIG.INITIAL_PAGE;
    }

    // Send a loading message
    const formattedMsg = joinWithNewlines(MESSAGES.FETCHING_ANNOUNCEMENTS, 2);
    const loadingMessage = await ctx.reply(formattedMsg.text, {
      entities: formattedMsg.entities,
    });
    ctx.session.announcementsMessageId = loadingMessage.message_id;

    // Get announcements, prepare keyboard and message text and send it
    const announcements = await fetchAnnouncements({
      pageNumber: ctx.session.announcementsPage,
      dataSize: LOOKUP_CONFIG.PAGE_SIZE,
    });
    const keyboard = generateAnnouncementsKeyboard(
      announcements,
      ctx.session.announcementsPage
    );
    const messageText = generateAnnouncementsText(announcements);

    // Store data in session
    ctx.session.announcementsAnnouncements = announcements;

    // Edit the loading message with the actual content
    await ctx.api.editMessageText(
      ctx.chat.id,
      loadingMessage.message_id,
      messageText.text,
      {
        reply_markup: keyboard,
        entities: messageText.entities,
      }
    );
  }
);

// Callback query handler for selecting announcements
// Callback query handlers - use protected composer for error boundary coverage
protectedComposer.callbackQuery(/^announcement_select_/, async ctx => {
  await ctx.answerCallbackQuery();

  // Parse and validate callback
  const parsed = parseSelectCallback(ctx.callbackQuery.data, "announcement");
  if (!parsed.isValid) {
    await ctx.editMessageText(
      `${emoji("cross_mark")} Invalid callback format. Please try again.`
    );
    return;
  }

  // Store message ID for error boundary cleanup
  storeCallbackMessageId(ctx, "announcementsMessageId");

  // Find selected announcement (throws SessionNotFoundError if not found)
  const announcement = findItemById(
    ctx.session.announcementsAnnouncements,
    parsed.id
  );

  // Handle selection flow
  await handleAnnouncementSelection(ctx, announcement);
  await handleAnnouncementAttachments(ctx, announcement);
});

// Handler for "View Another" - Yes
protectedComposer.callbackQuery("announcement_view_another_true", async ctx => {
  await ctx.answerCallbackQuery();

  // Reset to first page and refetch
  ctx.session.announcementsPage = LOOKUP_CONFIG.INITIAL_PAGE;
  await fetchAndDisplayAnnouncements(ctx);
});

// Handler for "View Another" - No
protectedComposer.callbackQuery(
  "announcement_view_another_false",
  async ctx => {
    await ctx.answerCallbackQuery();

    await ctx.editMessageText(
      `Announcements lookup ended. Use ${formatCommand(announcementsLookupCommand)} to start again.`
    );

    // Clear session data
    ctx.session.announcementsPage = null;
    ctx.session.announcementsAnnouncements = [];
    ctx.session.announcementsMessageId = null;
  }
);

// Callback query handlers for navigation
protectedComposer.callbackQuery("announcement_page_info", async ctx => {
  await ctx.answerCallbackQuery();
});

protectedComposer.callbackQuery("announcement_prev_page", async ctx => {
  await ctx.answerCallbackQuery();

  const currentPage =
    ctx.session.announcementsPage ?? LOOKUP_CONFIG.INITIAL_PAGE;
  if (currentPage === LOOKUP_CONFIG.INITIAL_PAGE) {
    await ctx.answerCallbackQuery("You are already on the first page.");
    return;
  }

  ctx.session.announcementsPage = currentPage - 1;
  await fetchAndDisplayAnnouncements(ctx);
});

protectedComposer.callbackQuery("announcement_next_page", async ctx => {
  await ctx.answerCallbackQuery();

  const currentPage =
    ctx.session.announcementsPage ?? LOOKUP_CONFIG.INITIAL_PAGE;
  ctx.session.announcementsPage = currentPage + 1;

  await fetchAndDisplayAnnouncements(ctx);

  // Check if we got results
  if (ctx.session.announcementsAnnouncements.length === 0) {
    ctx.session.announcementsPage = currentPage; // Revert
    await ctx.editMessageText(
      `${emoji("cross_mark")} No more announcements found.`
    );
  }
});

// Create the announcement commands command group
const announcementsCommands = new CommandGroup<BotContext>();

// Add commands to the group
announcementsCommands.add(announcementsLookupCommand);

// Hook the command group into the protected composer (with error boundary)
protectedComposer.use(announcementsCommands);

export const announcementsLookup = composer;
export { announcementsCommands, announcementsLookupCommand };
