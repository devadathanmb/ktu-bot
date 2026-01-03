import { BotContext } from "../../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer, InlineKeyboard } from "grammy";
import { Announcement } from "../../../../types/service.types.js";
import {
  generatePaginatedKeyboard,
  generatePaginatedMessageText,
} from "../helpers.js";
import { FormattedString, fmt, b } from "@grammyjs/parse-mode";
import { SessionNotFoundError } from "../../../../errors/index.js";
import {
  joinWithNewlines,
  formatCommand,
} from "../../../../utils/formatting.js";
import { createAnnouncementsErrorBoundary } from "../../shared/errorBoundary.js";
import { emoji } from "@grammyjs/emoji";
import { fetchAnnouncements } from "../../../../api/services/index.js";
import { addAttachmentDeliveryJob } from "../../../../workers/attachment-delivery/index.js";

// Common messages used throughout the composer
const MESSAGES: Record<string, FormattedString[]> = {
  FETCHING_ANNOUNCEMENTS: [
    fmt`${emoji("hourglass_not_done")} Fetching announcements... Please wait...`,
  ],
  FETCHING_DETAILS: [
    fmt`${emoji("hourglass_not_done")} Fetching announcement details... Please wait...`,
  ],
} as const;

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
      ctx.session.announcementsPage = 0;
    }

    // Send a loading message
    const formattedMsg = joinWithNewlines(MESSAGES.FETCHING_ANNOUNCEMENTS!, 2);
    const loadingMessage = await ctx.reply(formattedMsg.text, {
      entities: formattedMsg.entities,
    });
    ctx.session.announcementsMessageId = loadingMessage.message_id;

    // Get announcements, prepare keyboard and message text and send it
    const announcements = await fetchAnnouncements({
      pageNumber: ctx.session.announcementsPage,
      dataSize: 10,
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

  const callbackData = ctx.callbackQuery.data;
  const callbackParts = callbackData.split("_");

  if (callbackParts.length < 3 || !callbackParts[2]) {
    await ctx.editMessageText(
      `${emoji("cross_mark")} Invalid callback format. Please try again.`
    );
    return;
  }

  const announcementId = parseInt(callbackParts[2]);

  if (!announcementId || ctx.session.announcementsAnnouncements.length === 0)
    throw new SessionNotFoundError();

  const selectedAnnouncement = ctx.session.announcementsAnnouncements.find(
    announcement => announcement.id === announcementId
  )!;

  const formattedFetchingMsg = joinWithNewlines(MESSAGES.FETCHING_DETAILS!, 2);
  await ctx.editMessageText(formattedFetchingMsg.text, {
    entities: formattedFetchingMsg.entities,
  });

  // Prepare the announcement details message
  const parts: FormattedString[] = [];
  if (selectedAnnouncement.subject) {
    parts.push(
      joinWithNewlines([
        fmt`${b}${emoji("open_book")} Subject:${b}`,
        fmt`${selectedAnnouncement.subject}`,
      ])
    );
  }
  if (selectedAnnouncement.message) {
    parts.push(
      joinWithNewlines([
        fmt`${b}${emoji("memo")} Message:${b}`,
        fmt`${selectedAnnouncement.message}`,
      ])
    );
  }
  if (selectedAnnouncement.formattedPublishedDate) {
    parts.push(
      joinWithNewlines([
        fmt`${b}${emoji("calendar")} Date:${b} ${selectedAnnouncement.formattedPublishedDate}`,
      ])
    );
  }

  const attachments = selectedAnnouncement.attachments || [];

  // Prepare message parts and combine
  const captionMsg: FormattedString = joinWithNewlines(parts, 2);
  if (attachments.length === 0) {
    // Create "View Another" keyboard
    const keyboard = new InlineKeyboard()
      .text(
        `${emoji("check_mark_button")} Yes`,
        "announcement_view_another_true"
      )
      .text(`${emoji("cross_mark")} No`, "announcement_view_another_false");

    await ctx.editMessageText(captionMsg.text, {
      reply_markup: keyboard,
      entities: captionMsg.entities,
    });
  } else {
    // Send the announcement details first
    await ctx.editMessageText(captionMsg.text, {
      entities: captionMsg.entities,
    });

    const plural = attachments.length > 1 ? "s" : "";
    const statusMessage = await ctx.reply(
      `${emoji("hourglass_not_done")} Downloading your file${plural} in the background... This may take a moment!`
    );

    const jobData: Parameters<typeof addAttachmentDeliveryJob>[0] = {
      chatId: ctx.chat!.id,
      attachments: attachments,
      statusMessageId: statusMessage.message_id,
      context: "announcement",
    };

    if (ctx.msgId !== undefined) {
      jobData.replyToMessageId = ctx.msgId;
    }

    await addAttachmentDeliveryJob(jobData);

    // Create "View Another" keyboard
    const keyboard = new InlineKeyboard()
      .text(
        `${emoji("check_mark_button")} Yes`,
        "announcement_view_another_true"
      )
      .text(`${emoji("cross_mark")} No`, "announcement_view_another_false");

    await ctx.reply(`${emoji("eyes")} View another announcement?`, {
      reply_markup: keyboard,
    });
  }
});

// Handler for "View Another" - Yes
protectedComposer.callbackQuery("announcement_view_another_true", async ctx => {
  await ctx.answerCallbackQuery();

  // Reset to page 0 and show announcements again
  ctx.session.announcementsPage = 0;

  // Store the message ID for error boundary cleanup
  ctx.session.announcementsMessageId = ctx.callbackQuery.message!.message_id;

  const formattedMsg = joinWithNewlines(MESSAGES.FETCHING_ANNOUNCEMENTS!, 2);
  await ctx.editMessageText(formattedMsg.text, {
    entities: formattedMsg.entities,
  });

  const announcements = await fetchAnnouncements({
    pageNumber: ctx.session.announcementsPage,
    dataSize: 10,
  });

  const keyboard = generateAnnouncementsKeyboard(
    announcements,
    ctx.session.announcementsPage
  );

  const messageText = generateAnnouncementsText(announcements);
  ctx.session.announcementsAnnouncements = announcements;

  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
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

  if (
    ctx.session.announcementsPage === null ||
    ctx.session.announcementsPage === 0
  ) {
    await ctx.answerCallbackQuery("You are already on the first page.");
    return;
  }

  ctx.session.announcementsPage--;

  // Store the message ID for error boundary cleanup
  ctx.session.announcementsMessageId = ctx.callbackQuery.message!.message_id;

  const formattedMsg = joinWithNewlines(MESSAGES.FETCHING_ANNOUNCEMENTS!, 2);
  await ctx.editMessageText(formattedMsg.text, {
    entities: formattedMsg.entities,
  });

  const announcements = await fetchAnnouncements({
    pageNumber: ctx.session.announcementsPage,
    dataSize: 10,
  });

  const keyboard = generateAnnouncementsKeyboard(
    announcements,
    ctx.session.announcementsPage
  );

  const messageText = generateAnnouncementsText(announcements);
  ctx.session.announcementsAnnouncements = announcements;

  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
});

protectedComposer.callbackQuery("announcement_next_page", async ctx => {
  await ctx.answerCallbackQuery();

  if (!ctx.session.announcementsPage) {
    ctx.session.announcementsPage = 0;
  }

  ctx.session.announcementsPage++;

  // Store the message ID for error boundary cleanup
  ctx.session.announcementsMessageId = ctx.callbackQuery.message!.message_id;

  const formattedMsg = joinWithNewlines(MESSAGES.FETCHING_ANNOUNCEMENTS!, 2);
  await ctx.editMessageText(formattedMsg.text, {
    entities: formattedMsg.entities,
  });

  const announcements = await fetchAnnouncements({
    pageNumber: ctx.session.announcementsPage,
    dataSize: 10,
  });

  // If no announcements found, revert page number
  if (announcements.length === 0) {
    ctx.session.announcementsPage--;
    await ctx.editMessageText(
      `${emoji("cross_mark")} No more announcements found.`
    );
    return;
  }

  const keyboard = generateAnnouncementsKeyboard(
    announcements,
    ctx.session.announcementsPage
  );

  const messageText = generateAnnouncementsText(announcements);
  ctx.session.announcementsAnnouncements = announcements;

  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
});

// Create the announcement commands command group
const announcementsCommands = new CommandGroup<BotContext>();

// Add commands to the group
announcementsCommands.add(announcementsLookupCommand);

// Hook the command group into the protected composer (with error boundary)
protectedComposer.use(announcementsCommands);

export const announcementsLookup = composer;
export { announcementsCommands, announcementsLookupCommand };
