import { BotContext } from "../../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer, InlineKeyboard } from "grammy";
import {
  Branch,
  Program,
  Scheme,
  SyllabusEntry,
} from "../../../../types/service.types.js";
import {
  generatePaginatedKeyboard,
  generatePaginatedMessageText,
  PaginatedItem,
  parseSelectCallback,
  createViewAnotherKeyboard,
  findItemById,
  storeCallbackMessageId,
  slicePage,
  totalPages,
} from "../utils.js";
import { LOOKUP_CONFIG } from "../constants.js";
import { FormattedString, fmt, b } from "@grammyjs/parse-mode";
import {
  joinWithNewlines,
  formatCommand,
} from "../../../../utils/formatting.js";
import { deleteMessageSafely } from "../../../../utils/bot.js";
import { createSyllabusErrorBoundary } from "../../shared/error-boundary.js";
import { emoji } from "@grammyjs/emoji";
import {
  fetchPrograms,
  fetchSchemes,
  fetchBranches,
  fetchSyllabus,
} from "../../../../api/services/index.js";
import { addAttachmentDeliveryJob } from "../../../../workers/attachment-delivery/queue.js";

// Callback prefixes — no underscores in the prefix itself so parseSelectCallback works
const CB = {
  PROGRAM: "syllabusprog",
  SCHEME: "syllabusscheme",
  BRANCH: "syllabusbranch",
  SYLLABUS: "syllabusentry",
  VIEW_ANOTHER: "syllabus",
} as const;

const MESSAGES = {
  FETCHING_PROGRAMS: [
    fmt`${emoji("hourglass_not_done")} Fetching programs... Please wait...`,
  ],
  FETCHING_SCHEMES: [
    fmt`${emoji("hourglass_not_done")} Fetching schemes... Please wait...`,
  ],
  FETCHING_BRANCHES: [
    fmt`${emoji("hourglass_not_done")} Fetching branches... Please wait...`,
  ],
  FETCHING_SYLLABUS: [
    fmt`${emoji("hourglass_not_done")} Fetching syllabus... Please wait...`,
  ],
};

// --- PaginatedItem mappers ---

function programsToPageItems(programs: Program[]): PaginatedItem[] {
  return programs.map(p => ({
    id: p.id,
    subject: p.name,
    formattedPublishedDate: p.description ?? "",
  }));
}

function schemesToPageItems(schemes: Scheme[]): PaginatedItem[] {
  return schemes.map(s => ({
    id: s.id,
    subject: s.scheme,
    formattedPublishedDate: `${s.academicYear} · ${s.programTypeName}`,
  }));
}

function branchesToPageItems(branches: Branch[]): PaginatedItem[] {
  return branches.map(b => ({
    id: b.id,
    subject: b.branchName,
    formattedPublishedDate: b.academicYear,
  }));
}

function syllabusEntriesToPageItems(
  entries: SyllabusEntry[],
  originalIndices: number[]
): PaginatedItem[] {
  return entries.map((s, i) => ({
    id: originalIndices[i]!,
    subject: s.attachmentName ?? s.description ?? "Syllabus",
    formattedPublishedDate: s.description ?? "",
  }));
}

function getDownloadableEntries(entries: SyllabusEntry[]): {
  entries: SyllabusEntry[];
  indices: number[];
} {
  const filtered: SyllabusEntry[] = [];
  const indices: number[] = [];
  entries.forEach((entry, i) => {
    if (entry.encryptAttachmentId !== null && entry.attachmentName !== null) {
      filtered.push(entry);
      indices.push(i);
    }
  });
  return { entries: filtered, indices };
}

// --- Keyboard / text generators ---

function buildProgramsKeyboard(
  programs: Program[],
  page: number
): InlineKeyboard {
  const pageItems = slicePage(programsToPageItems(programs), page);
  return generatePaginatedKeyboard(
    pageItems,
    page,
    CB.PROGRAM,
    LOOKUP_CONFIG.ITEMS_PER_ROW
  );
}

function buildProgramsText(programs: Program[], page: number): FormattedString {
  const pageItems = slicePage(programsToPageItems(programs), page);
  return generatePaginatedMessageText(
    pageItems,
    `${emoji("scroll")} Syllabus Lookup — Select Program`,
    "program",
    "Description"
  );
}

function buildSchemesKeyboard(schemes: Scheme[], page: number): InlineKeyboard {
  const pageItems = slicePage(schemesToPageItems(schemes), page);
  return generatePaginatedKeyboard(
    pageItems,
    page,
    CB.SCHEME,
    LOOKUP_CONFIG.ITEMS_PER_ROW
  );
}

function buildSchemesText(schemes: Scheme[], page: number): FormattedString {
  const pageItems = slicePage(schemesToPageItems(schemes), page);
  return generatePaginatedMessageText(
    pageItems,
    `${emoji("scroll")} Syllabus Lookup — Select Scheme`,
    "scheme",
    "Academic year"
  );
}

function buildBranchesKeyboard(
  branches: Branch[],
  page: number
): InlineKeyboard {
  const pageItems = slicePage(branchesToPageItems(branches), page);
  return generatePaginatedKeyboard(
    pageItems,
    page,
    CB.BRANCH,
    LOOKUP_CONFIG.ITEMS_PER_ROW
  );
}

function buildBranchesText(branches: Branch[], page: number): FormattedString {
  const pageItems = slicePage(branchesToPageItems(branches), page);
  return generatePaginatedMessageText(
    pageItems,
    `${emoji("scroll")} Syllabus Lookup — Select Branch`,
    "branch",
    "Academic year"
  );
}

function buildSyllabusEntriesKeyboard(
  downloadable: SyllabusEntry[],
  originalIndices: number[],
  page: number
): InlineKeyboard {
  const pageItems = syllabusEntriesToPageItems(downloadable, originalIndices);
  const sliced = slicePage(pageItems, page);
  return generatePaginatedKeyboard(
    sliced,
    page,
    CB.SYLLABUS,
    LOOKUP_CONFIG.ITEMS_PER_ROW
  );
}

function buildSyllabusEntriesText(
  downloadable: SyllabusEntry[],
  originalIndices: number[],
  page: number
): FormattedString {
  const pageItems = syllabusEntriesToPageItems(downloadable, originalIndices);
  const sliced = slicePage(pageItems, page);
  return generatePaginatedMessageText(
    sliced,
    `${emoji("scroll")} Syllabus Lookup — Select Entry`,
    "entry",
    "Description"
  );
}

async function renderSyllabusEntriesStep(
  ctx: BotContext,
  entries: SyllabusEntry[],
  page: number
): Promise<void> {
  ctx.session.syllabusEntries = entries;
  ctx.session.syllabusSyllabusPage = page;

  const { entries: downloadable, indices } = getDownloadableEntries(entries);
  const keyboard = buildSyllabusEntriesKeyboard(downloadable, indices, page);
  const text = buildSyllabusEntriesText(downloadable, indices, page);

  await ctx.editMessageText(text.text, {
    reply_markup: keyboard,
    entities: text.entities,
  });
}

// --- Step renderers (edit the existing message in-place) ---

async function renderProgramsStep(
  ctx: BotContext,
  programs: Program[],
  page: number
): Promise<void> {
  ctx.session.syllabusPrograms = programs;
  ctx.session.syllabusProgramPage = page;

  const keyboard = buildProgramsKeyboard(programs, page);
  const text = buildProgramsText(programs, page);

  await ctx.editMessageText(text.text, {
    reply_markup: keyboard,
    entities: text.entities,
  });
}

async function renderSchemesStep(
  ctx: BotContext,
  schemes: Scheme[],
  page: number
): Promise<void> {
  ctx.session.syllabusSchemes = schemes;
  ctx.session.syllabusSchemePage = page;

  const keyboard = buildSchemesKeyboard(schemes, page);
  const text = buildSchemesText(schemes, page);

  await ctx.editMessageText(text.text, {
    reply_markup: keyboard,
    entities: text.entities,
  });
}

async function renderBranchesStep(
  ctx: BotContext,
  branches: Branch[],
  page: number
): Promise<void> {
  ctx.session.syllabusBranches = branches;
  ctx.session.syllabusBranchPage = page;

  const keyboard = buildBranchesKeyboard(branches, page);
  const text = buildBranchesText(branches, page);

  await ctx.editMessageText(text.text, {
    reply_markup: keyboard,
    entities: text.entities,
  });
}

// --- Reset helpers ---

function clearSyllabusSession(ctx: BotContext): void {
  ctx.session.syllabusProgramPage = null;
  ctx.session.syllabusSchemePage = null;
  ctx.session.syllabusBranchPage = null;
  ctx.session.syllabusSyllabusPage = null;
  ctx.session.syllabusPrograms = [];
  ctx.session.syllabusSchemes = [];
  ctx.session.syllabusBranches = [];
  ctx.session.syllabusEntries = [];
  ctx.session.syllabusSelectedProgramId = null;
  ctx.session.syllabusSelectedSchemeId = null;
  ctx.session.syllabusMessageId = null;
}

function buildSyllabusJobData(
  ctx: BotContext,
  entry: SyllabusEntry,
  statusMessageId: number
): Parameters<typeof addAttachmentDeliveryJob>[0] {
  const jobData: Parameters<typeof addAttachmentDeliveryJob>[0] = {
    chatId: ctx.chat!.id,
    attachments: [
      {
        name: entry.attachmentName!,
        encryptId: entry.encryptAttachmentId!,
        source: "syllabus" as const,
      },
    ],
    statusMessageId,
    context: "syllabus",
    sendViewAnotherMessage: true,
  };

  if (ctx.msgId !== undefined) {
    jobData.replyToMessageId = ctx.msgId;
  }

  return jobData;
}

// --- Composers ---

const composer = new Composer<BotContext>();
const protectedComposer = composer.errorBoundary(createSyllabusErrorBoundary());

// /syllabus command
const syllabusLookupCommand = new Command<BotContext>(
  "syllabus",
  `${emoji("scroll")} Browse and download KTU syllabi by program and branch`,
  async (ctx: BotContext) => {
    clearSyllabusSession(ctx);
    ctx.session.syllabusProgramPage = LOOKUP_CONFIG.INITIAL_PAGE;

    const loadingMsg = joinWithNewlines(MESSAGES.FETCHING_PROGRAMS, 2);
    const statusMessage = await ctx.reply(loadingMsg.text, {
      entities: loadingMsg.entities,
    });
    ctx.session.syllabusMessageId = statusMessage.message_id;

    const programs = await fetchPrograms();

    const keyboard = buildProgramsKeyboard(
      programs,
      LOOKUP_CONFIG.INITIAL_PAGE
    );
    const text = buildProgramsText(programs, LOOKUP_CONFIG.INITIAL_PAGE);

    ctx.session.syllabusPrograms = programs;

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMessage.message_id,
      text.text,
      {
        reply_markup: keyboard,
        entities: text.entities,
      }
    );
  }
);

// --- Program step callbacks ---

protectedComposer.callbackQuery(
  new RegExp(`^${CB.PROGRAM}_select_\\d+$`),
  async ctx => {
    await ctx.answerCallbackQuery();
    storeCallbackMessageId(ctx, "syllabusMessageId");

    const parsed = parseSelectCallback(ctx.callbackQuery.data, CB.PROGRAM);
    if (!parsed.isValid) {
      await ctx.editMessageText(
        `${emoji("cross_mark")} Invalid selection. Please try again.`
      );
      return;
    }

    const program = findItemById(ctx.session.syllabusPrograms, parsed.id);
    ctx.session.syllabusSelectedProgramId = program.id;

    const loadingMsg = joinWithNewlines(MESSAGES.FETCHING_SCHEMES, 2);
    await ctx.editMessageText(loadingMsg.text, {
      entities: loadingMsg.entities,
    });

    const schemes = await fetchSchemes({ programId: program.id });

    if (schemes.length === 0) {
      await ctx.editMessageText(
        joinWithNewlines([
          fmt`${emoji("woman_shrugging")} No schemes found for ${b}${program.name}${b}.`,
        ]).text,
        { reply_markup: createViewAnotherKeyboard(CB.VIEW_ANOTHER) }
      );
      return;
    }

    await renderSchemesStep(ctx, schemes, LOOKUP_CONFIG.INITIAL_PAGE);
  }
);

protectedComposer.callbackQuery(`${CB.PROGRAM}_page_info`, async ctx => {
  await ctx.answerCallbackQuery();
});

protectedComposer.callbackQuery(`${CB.PROGRAM}_prev_page`, async ctx => {
  storeCallbackMessageId(ctx, "syllabusMessageId");

  const page = ctx.session.syllabusProgramPage ?? LOOKUP_CONFIG.INITIAL_PAGE;
  if (page === LOOKUP_CONFIG.INITIAL_PAGE) {
    await ctx.answerCallbackQuery("You are already on the first page.");
    return;
  }

  await ctx.answerCallbackQuery();
  const newPage = page - 1;
  ctx.session.syllabusProgramPage = newPage;
  await renderProgramsStep(ctx, ctx.session.syllabusPrograms, newPage);
});

protectedComposer.callbackQuery(`${CB.PROGRAM}_next_page`, async ctx => {
  storeCallbackMessageId(ctx, "syllabusMessageId");

  const page = ctx.session.syllabusProgramPage ?? LOOKUP_CONFIG.INITIAL_PAGE;
  if (page + 1 >= totalPages(ctx.session.syllabusPrograms.length)) {
    await ctx.answerCallbackQuery("You are already on the last page.");
    return;
  }

  await ctx.answerCallbackQuery();
  const newPage = page + 1;
  ctx.session.syllabusProgramPage = newPage;
  await renderProgramsStep(ctx, ctx.session.syllabusPrograms, newPage);
});

// --- Scheme step callbacks ---

protectedComposer.callbackQuery(
  new RegExp(`^${CB.SCHEME}_select_\\d+$`),
  async ctx => {
    await ctx.answerCallbackQuery();
    storeCallbackMessageId(ctx, "syllabusMessageId");

    const parsed = parseSelectCallback(ctx.callbackQuery.data, CB.SCHEME);
    if (!parsed.isValid) {
      await ctx.editMessageText(
        `${emoji("cross_mark")} Invalid selection. Please try again.`
      );
      return;
    }

    const scheme = findItemById(ctx.session.syllabusSchemes, parsed.id);
    ctx.session.syllabusSelectedSchemeId = scheme.id;

    const loadingMsg = joinWithNewlines(MESSAGES.FETCHING_BRANCHES, 2);
    await ctx.editMessageText(loadingMsg.text, {
      entities: loadingMsg.entities,
    });

    const branches = await fetchBranches({ schemeId: scheme.id });

    if (branches.length === 0) {
      await ctx.editMessageText(
        joinWithNewlines([
          fmt`${emoji("woman_shrugging")} No branches found for ${b}${scheme.scheme}${b}.`,
        ]).text,
        { reply_markup: createViewAnotherKeyboard(CB.VIEW_ANOTHER) }
      );
      return;
    }

    await renderBranchesStep(ctx, branches, LOOKUP_CONFIG.INITIAL_PAGE);
  }
);

protectedComposer.callbackQuery(`${CB.SCHEME}_page_info`, async ctx => {
  await ctx.answerCallbackQuery();
});

protectedComposer.callbackQuery(`${CB.SCHEME}_prev_page`, async ctx => {
  storeCallbackMessageId(ctx, "syllabusMessageId");

  const page = ctx.session.syllabusSchemePage ?? LOOKUP_CONFIG.INITIAL_PAGE;
  if (page === LOOKUP_CONFIG.INITIAL_PAGE) {
    await ctx.answerCallbackQuery("You are already on the first page.");
    return;
  }

  await ctx.answerCallbackQuery();
  const newPage = page - 1;
  ctx.session.syllabusSchemePage = newPage;
  await renderSchemesStep(ctx, ctx.session.syllabusSchemes, newPage);
});

protectedComposer.callbackQuery(`${CB.SCHEME}_next_page`, async ctx => {
  storeCallbackMessageId(ctx, "syllabusMessageId");

  const page = ctx.session.syllabusSchemePage ?? LOOKUP_CONFIG.INITIAL_PAGE;
  if (page + 1 >= totalPages(ctx.session.syllabusSchemes.length)) {
    await ctx.answerCallbackQuery("You are already on the last page.");
    return;
  }

  await ctx.answerCallbackQuery();
  const newPage = page + 1;
  ctx.session.syllabusSchemePage = newPage;
  await renderSchemesStep(ctx, ctx.session.syllabusSchemes, newPage);
});

// --- Branch step callbacks ---

protectedComposer.callbackQuery(
  new RegExp(`^${CB.BRANCH}_select_\\d+$`),
  async ctx => {
    await ctx.answerCallbackQuery();
    storeCallbackMessageId(ctx, "syllabusMessageId");

    const parsed = parseSelectCallback(ctx.callbackQuery.data, CB.BRANCH);
    if (!parsed.isValid) {
      await ctx.editMessageText(
        `${emoji("cross_mark")} Invalid selection. Please try again.`
      );
      return;
    }

    // id is the curriculumId
    const branch = findItemById(ctx.session.syllabusBranches, parsed.id);

    const loadingMsg = joinWithNewlines(MESSAGES.FETCHING_SYLLABUS, 2);
    await ctx.editMessageText(loadingMsg.text, {
      entities: loadingMsg.entities,
    });

    const syllabusEntries = await fetchSyllabus({ curriculumId: branch.id });

    const { entries: downloadable } = getDownloadableEntries(syllabusEntries);

    if (downloadable.length === 0) {
      const noSyllabusMsg = joinWithNewlines(
        [
          fmt`${emoji("woman_shrugging")} No syllabus uploaded yet for ${b}${branch.branchName}${b}.`,
          fmt`Try another branch or check back later.`,
        ],
        2
      );

      await ctx.editMessageText(noSyllabusMsg.text, {
        reply_markup: createViewAnotherKeyboard(CB.VIEW_ANOTHER),
        entities: noSyllabusMsg.entities,
      });
      return;
    }

    if (downloadable.length === 1) {
      const entry = downloadable[0]!;
      await deleteMessageSafely(ctx, ctx.callbackQuery?.message?.message_id);

      const statusMessage = await ctx.reply(
        `${emoji("hourglass_not_done")} Downloading syllabus in the background... This may take a moment!`
      );

      await addAttachmentDeliveryJob(
        buildSyllabusJobData(ctx, entry, statusMessage.message_id)
      );
      return;
    }

    await renderSyllabusEntriesStep(
      ctx,
      syllabusEntries,
      LOOKUP_CONFIG.INITIAL_PAGE
    );
  }
);

protectedComposer.callbackQuery(`${CB.BRANCH}_page_info`, async ctx => {
  await ctx.answerCallbackQuery();
});

protectedComposer.callbackQuery(`${CB.BRANCH}_prev_page`, async ctx => {
  storeCallbackMessageId(ctx, "syllabusMessageId");

  const page = ctx.session.syllabusBranchPage ?? LOOKUP_CONFIG.INITIAL_PAGE;
  if (page === LOOKUP_CONFIG.INITIAL_PAGE) {
    await ctx.answerCallbackQuery("You are already on the first page.");
    return;
  }

  await ctx.answerCallbackQuery();
  const newPage = page - 1;
  ctx.session.syllabusBranchPage = newPage;
  await renderBranchesStep(ctx, ctx.session.syllabusBranches, newPage);
});

protectedComposer.callbackQuery(`${CB.BRANCH}_next_page`, async ctx => {
  storeCallbackMessageId(ctx, "syllabusMessageId");

  const page = ctx.session.syllabusBranchPage ?? LOOKUP_CONFIG.INITIAL_PAGE;
  if (page + 1 >= totalPages(ctx.session.syllabusBranches.length)) {
    await ctx.answerCallbackQuery("You are already on the last page.");
    return;
  }

  await ctx.answerCallbackQuery();
  const newPage = page + 1;
  ctx.session.syllabusBranchPage = newPage;
  await renderBranchesStep(ctx, ctx.session.syllabusBranches, newPage);
});

// --- Syllabus entry step callbacks ---

protectedComposer.callbackQuery(
  new RegExp(`^${CB.SYLLABUS}_select_\\d+$`),
  async ctx => {
    await ctx.answerCallbackQuery();
    storeCallbackMessageId(ctx, "syllabusMessageId");

    const parsed = parseSelectCallback(ctx.callbackQuery.data, CB.SYLLABUS);
    if (!parsed.isValid) {
      await ctx.editMessageText(
        `${emoji("cross_mark")} Invalid selection. Please try again.`
      );
      return;
    }

    const originalIndex = parsed.id;
    const entries = ctx.session.syllabusEntries ?? [];
    const entry = entries[originalIndex];
    if (
      !entry ||
      entry.encryptAttachmentId === null ||
      entry.attachmentName === null
    ) {
      await ctx.editMessageText(
        `${emoji("cross_mark")} Invalid selection. Please try again.`
      );
      return;
    }

    await deleteMessageSafely(ctx, ctx.callbackQuery?.message?.message_id);

    const statusMessage = await ctx.reply(
      `${emoji("hourglass_not_done")} Downloading syllabus in the background... This may take a moment!`
    );

    await addAttachmentDeliveryJob(
      buildSyllabusJobData(ctx, entry, statusMessage.message_id)
    );
  }
);

protectedComposer.callbackQuery(`${CB.SYLLABUS}_page_info`, async ctx => {
  await ctx.answerCallbackQuery();
});

protectedComposer.callbackQuery(`${CB.SYLLABUS}_prev_page`, async ctx => {
  storeCallbackMessageId(ctx, "syllabusMessageId");

  const page = ctx.session.syllabusSyllabusPage ?? LOOKUP_CONFIG.INITIAL_PAGE;
  if (page === LOOKUP_CONFIG.INITIAL_PAGE) {
    await ctx.answerCallbackQuery("You are already on the first page.");
    return;
  }

  await ctx.answerCallbackQuery();
  const newPage = page - 1;
  ctx.session.syllabusSyllabusPage = newPage;
  await renderSyllabusEntriesStep(
    ctx,
    ctx.session.syllabusEntries ?? [],
    newPage
  );
});

protectedComposer.callbackQuery(`${CB.SYLLABUS}_next_page`, async ctx => {
  storeCallbackMessageId(ctx, "syllabusMessageId");

  const entries = ctx.session.syllabusEntries ?? [];
  const { entries: downloadable } = getDownloadableEntries(entries);
  const page = ctx.session.syllabusSyllabusPage ?? LOOKUP_CONFIG.INITIAL_PAGE;
  if (page + 1 >= totalPages(downloadable.length)) {
    await ctx.answerCallbackQuery("You are already on the last page.");
    return;
  }

  await ctx.answerCallbackQuery();
  const newPage = page + 1;
  ctx.session.syllabusSyllabusPage = newPage;
  await renderSyllabusEntriesStep(ctx, entries, newPage);
});

// --- View another callbacks ---

protectedComposer.callbackQuery(
  `${CB.VIEW_ANOTHER}_view_another_true`,
  async ctx => {
    await ctx.answerCallbackQuery();
    storeCallbackMessageId(ctx, "syllabusMessageId");

    clearSyllabusSession(ctx);
    ctx.session.syllabusProgramPage = LOOKUP_CONFIG.INITIAL_PAGE;

    const loadingMsg = joinWithNewlines(MESSAGES.FETCHING_PROGRAMS, 2);
    await ctx.editMessageText(loadingMsg.text, {
      entities: loadingMsg.entities,
    });

    const programs = await fetchPrograms();
    await renderProgramsStep(ctx, programs, LOOKUP_CONFIG.INITIAL_PAGE);
  }
);

protectedComposer.callbackQuery(
  `${CB.VIEW_ANOTHER}_view_another_false`,
  async ctx => {
    await ctx.answerCallbackQuery();

    await ctx.editMessageText(
      `Syllabus lookup ended. Use ${formatCommand(syllabusLookupCommand)} to start again.`
    );

    clearSyllabusSession(ctx);
  }
);

// --- Command group ---

const syllabusCommands = new CommandGroup<BotContext>();
syllabusCommands.add(syllabusLookupCommand);
protectedComposer.use(syllabusCommands);

export const syllabusLookup = composer;
export { syllabusCommands, syllabusLookupCommand };
