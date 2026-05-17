import { BotContext } from "../../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer, InlineKeyboard } from "grammy";
import { ExamTimeTable } from "../../../../types/service.types.js";
import {
  generatePaginatedKeyboard,
  generatePaginatedMessageText,
  PaginatedItem,
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
import { createTimetableErrorBoundary } from "../../shared/error-boundary.js";
import { emoji } from "@grammyjs/emoji";
import { fetchTimetables } from "../../../../api/services/index.js";
import { addAttachmentDeliveryJob } from "../../../../workers/attachment-delivery/queue.js";

const MESSAGES = {
  FETCHING_TIMETABLES: [
    fmt`${emoji("hourglass_not_done")} Fetching timetables... Please wait...`,
  ],
  FETCHING_DETAILS: [
    fmt`${emoji("hourglass_not_done")} Fetching timetable details... Please wait...`,
  ],
};

function generateTimetablesKeyboard(
  timetables: ExamTimeTable[],
  currentPage: number
): InlineKeyboard {
  const paginatedItems: PaginatedItem[] = timetables.map(timetable => ({
    id: timetable.id,
    subject: timetable.title,
    formattedPublishedDate: timetable.formattedPublishedDate,
  }));
  return generatePaginatedKeyboard(paginatedItems, currentPage, "timetable", 5);
}

function generateTimetablesText(timetables: ExamTimeTable[]): FormattedString {
  const paginatedItems: PaginatedItem[] = timetables.map(timetable => ({
    id: timetable.id,
    subject: timetable.title,
    formattedPublishedDate: timetable.formattedPublishedDate,
  }));
  return generatePaginatedMessageText(
    paginatedItems,
    `${emoji("books")} Exam Timetables`,
    "timetable"
  );
}

function formatTimetableDetails(timetable: ExamTimeTable): FormattedString {
  const parts: FormattedString[] = [];

  if (timetable.title) {
    parts.push(
      joinWithNewlines([
        fmt`${b}${emoji("glowing_star")} Title:${b}`,
        fmt`${timetable.title}`,
      ])
    );
  }
  if (timetable.formattedPublishedDate) {
    parts.push(
      fmt`${b}${emoji("calendar")} Date:${b} ${timetable.formattedPublishedDate}`
    );
  }

  return joinWithNewlines(parts, 2);
}

async function handleTimetableSelection(
  ctx: BotContext,
  timetable: ExamTimeTable
): Promise<void> {
  const loadingMsg = joinWithNewlines(MESSAGES.FETCHING_DETAILS, 2);
  await ctx.editMessageText(loadingMsg.text, {
    entities: loadingMsg.entities,
  });

  const detailsMsg = formatTimetableDetails(timetable);
  await ctx.editMessageText(detailsMsg.text, {
    entities: detailsMsg.entities,
  });
}

async function handleTimetableAttachment(
  ctx: BotContext,
  timetable: ExamTimeTable
): Promise<void> {
  const keyboard = createViewAnotherKeyboard("timetable");

  if (!timetable.attachmentId) {
    const noAttachmentMsg = joinWithNewlines(
      [
        formatTimetableDetails(timetable),
        fmt`${emoji("woman_shrugging")} No attachment found for this timetable.`,
      ],
      2
    );

    await ctx.editMessageText(noAttachmentMsg.text, {
      reply_markup: keyboard,
      entities: noAttachmentMsg.entities,
    });
    return;
  }

  const statusMessage = await ctx.reply(
    `${emoji("hourglass_not_done")} Downloading your timetable in the background... This may take a moment!`
  );

  const jobData: Parameters<typeof addAttachmentDeliveryJob>[0] = {
    chatId: ctx.chat!.id,
    attachments: [
      {
        name: timetable.fileName!,
        encryptId: timetable.encryptId!,
      },
    ],
    statusMessageId: statusMessage.message_id,
    context: "timetable",
    sendViewAnotherMessage: true,
  };

  if (ctx.msgId !== undefined) {
    jobData.replyToMessageId = ctx.msgId;
  }

  await addAttachmentDeliveryJob(jobData);
}

async function fetchAndDisplayTimetables(ctx: BotContext): Promise<void> {
  storeCallbackMessageId(ctx, "timetableMessageId");

  const loadingMsg = joinWithNewlines(MESSAGES.FETCHING_TIMETABLES, 2);
  await ctx.editMessageText(loadingMsg.text, {
    entities: loadingMsg.entities,
  });

  const timetables = await fetchTimetables({
    pageNumber: ctx.session.timetablePage ?? LOOKUP_CONFIG.INITIAL_PAGE,
    dataSize: LOOKUP_CONFIG.PAGE_SIZE,
  });

  ctx.session.timetableTimetables = timetables;
  const keyboard = generateTimetablesKeyboard(
    timetables,
    ctx.session.timetablePage ?? LOOKUP_CONFIG.INITIAL_PAGE
  );
  const messageText = generateTimetablesText(timetables);

  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
}

const composer = new Composer<BotContext>();

const protectedComposer = composer.errorBoundary(
  createTimetableErrorBoundary()
);

const timetableLookupCommand = new Command<BotContext>(
  "timetables",
  `${emoji("books")} Find published exam timetables from KTU`,
  async (ctx: BotContext) => {
    if (ctx.session.timetablePage === null) {
      ctx.session.timetablePage = LOOKUP_CONFIG.INITIAL_PAGE;
    }

    const formattedMsg = joinWithNewlines(MESSAGES.FETCHING_TIMETABLES, 2);
    const loadingMessage = await ctx.reply(formattedMsg.text, {
      entities: formattedMsg.entities,
    });

    ctx.session.timetableMessageId = loadingMessage.message_id;

    const timetables = await fetchTimetables({
      pageNumber: ctx.session.timetablePage,
      dataSize: LOOKUP_CONFIG.PAGE_SIZE,
    });

    const keyboard = generateTimetablesKeyboard(
      timetables,
      ctx.session.timetablePage
    );

    const messageText = generateTimetablesText(timetables);

    ctx.session.timetableTimetables = timetables;

    await ctx.api.editMessageText(
      ctx.chat!.id,
      loadingMessage.message_id,
      messageText.text,
      {
        reply_markup: keyboard,
        entities: messageText.entities,
      }
    );

    ctx.session.timetableMessageId = loadingMessage.message_id;
  }
);

protectedComposer.callbackQuery(/^timetable_select_/, async ctx => {
  await ctx.answerCallbackQuery();

  const parsed = parseSelectCallback(ctx.callbackQuery.data, "timetable");
  if (!parsed.isValid) {
    await ctx.editMessageText(
      `${emoji("cross_mark")} Invalid callback format. Please try again.`
    );
    return;
  }

  storeCallbackMessageId(ctx, "timetableMessageId");

  const timetable = findItemById(ctx.session.timetableTimetables, parsed.id);

  await handleTimetableSelection(ctx, timetable);
  await handleTimetableAttachment(ctx, timetable);
});

protectedComposer.callbackQuery("timetable_view_another_true", async ctx => {
  await ctx.answerCallbackQuery();

  // Reset to first page and refetch
  ctx.session.timetablePage = LOOKUP_CONFIG.INITIAL_PAGE;
  await fetchAndDisplayTimetables(ctx);
});

protectedComposer.callbackQuery("timetable_view_another_false", async ctx => {
  await ctx.answerCallbackQuery();

  await ctx.editMessageText(
    `Timetable lookup ended. Use ${formatCommand(timetableLookupCommand)} to start again.`
  );

  ctx.session.timetablePage = null;
  ctx.session.timetableTimetables = [];
  ctx.session.timetableMessageId = null;
});

protectedComposer.callbackQuery("timetable_page_info", async ctx => {
  await ctx.answerCallbackQuery();
});

protectedComposer.callbackQuery("timetable_prev_page", async ctx => {
  await ctx.answerCallbackQuery();

  const currentPage = ctx.session.timetablePage ?? LOOKUP_CONFIG.INITIAL_PAGE;
  if (currentPage === LOOKUP_CONFIG.INITIAL_PAGE) {
    await ctx.answerCallbackQuery("You are already on the first page.");
    return;
  }

  ctx.session.timetablePage = currentPage - 1;
  await fetchAndDisplayTimetables(ctx);
});

protectedComposer.callbackQuery("timetable_next_page", async ctx => {
  await ctx.answerCallbackQuery();

  const currentPage = ctx.session.timetablePage ?? LOOKUP_CONFIG.INITIAL_PAGE;

  // If current page returned fewer items than PAGE_SIZE, we're on the last page
  if (ctx.session.timetableTimetables.length < LOOKUP_CONFIG.PAGE_SIZE) {
    await ctx.answerCallbackQuery("You are already on the last page.");
    return;
  }

  ctx.session.timetablePage = currentPage + 1;

  await fetchAndDisplayTimetables(ctx);

  if (ctx.session.timetableTimetables.length === 0) {
    ctx.session.timetablePage = currentPage; // Revert
    await ctx.editMessageText(
      `${emoji("cross_mark")} No more timetables found.`
    );
  }
});

const timetableCommands = new CommandGroup<BotContext>();

timetableCommands.add(timetableLookupCommand);

protectedComposer.use(timetableCommands);

export const timetableLookup = composer;
export { timetableCommands, timetableLookupCommand };
