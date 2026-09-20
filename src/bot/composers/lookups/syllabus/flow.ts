import { emoji } from "@grammyjs/emoji";
import { b, fmt } from "@grammyjs/parse-mode";
import { CallbackQueryContext } from "grammy";
import { BotContext } from "../../../../types/bot.types.js";
import {
  Branch,
  Program,
  Scheme,
  SyllabusEntry,
} from "../../../../types/service.types.js";
import {
  deleteMessageSafely,
  editMessageIgnoringNotModified,
} from "../../../../utils/bot.js";
import logger from "../../../../utils/logger.js";
import { joinWithNewlines } from "../../../../utils/formatting.js";
import type { AttachmentDeliveryJob } from "../../../../workers/attachment-delivery/queue.js";
import { createViewAnotherKeyboard } from "../../../utils/presentation.js";
import { LOOKUP_CONFIG } from "../constants.js";
import {
  findItemById,
  parseSelectCallback,
  storeCallbackMessageId,
  totalPages,
} from "../utils.js";
import { CB } from "./constants.js";
import {
  buildBranchesPage,
  buildProgramsPage,
  buildSchemesPage,
  buildSyllabusEntriesPage,
  getDownloadableEntries,
} from "./views.js";

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

type CallbackContext = CallbackQueryContext<BotContext>;
type Step = "program" | "scheme" | "branch" | "entry";

// Every dependency is required: the composer wires the live KTU fetchers and
// the attachment-delivery queue exactly once, and the flow closes over them.
export interface SyllabusFlowDeps {
  fetchPrograms: () => Promise<Program[]>;
  fetchSchemes: (params: { programId: number }) => Promise<Scheme[]>;
  fetchBranches: (params: { schemeId: number }) => Promise<Branch[]>;
  fetchSyllabus: (params: { curriculumId: number }) => Promise<SyllabusEntry[]>;
  queueDownload: (job: AttachmentDeliveryJob) => Promise<unknown>;
}

export interface SyllabusFlow {
  start(ctx: BotContext): Promise<void>;
  selectProgram(ctx: CallbackContext): Promise<void>;
  selectScheme(ctx: CallbackContext): Promise<void>;
  selectBranch(ctx: CallbackContext): Promise<void>;
  selectEntry(ctx: CallbackContext): Promise<void>;
  restart(ctx: CallbackContext): Promise<void>;
}

async function renderPrograms(
  ctx: BotContext,
  programs: Program[],
  page: number
): Promise<void> {
  ctx.session.syllabusPrograms = programs;
  ctx.session.syllabusProgramPage = page;
  const { text, keyboard } = buildProgramsPage(programs, page);
  await editMessageIgnoringNotModified(() =>
    ctx.editMessageText(text.text, {
      reply_markup: keyboard,
      entities: text.entities,
    })
  );
}

async function renderSchemes(
  ctx: BotContext,
  schemes: Scheme[],
  page: number
): Promise<void> {
  ctx.session.syllabusSchemes = schemes;
  ctx.session.syllabusSchemePage = page;
  const { text, keyboard } = buildSchemesPage(schemes, page);
  await editMessageIgnoringNotModified(() =>
    ctx.editMessageText(text.text, {
      reply_markup: keyboard,
      entities: text.entities,
    })
  );
}

async function renderBranches(
  ctx: BotContext,
  branches: Branch[],
  page: number
): Promise<void> {
  ctx.session.syllabusBranches = branches;
  ctx.session.syllabusBranchPage = page;
  const { text, keyboard } = buildBranchesPage(branches, page);
  await editMessageIgnoringNotModified(() =>
    ctx.editMessageText(text.text, {
      reply_markup: keyboard,
      entities: text.entities,
    })
  );
}

async function renderEntries(
  ctx: BotContext,
  entries: SyllabusEntry[],
  page: number
): Promise<void> {
  ctx.session.syllabusEntries = entries;
  ctx.session.syllabusSyllabusPage = page;
  const { text, keyboard } = buildSyllabusEntriesPage(entries, page);
  await editMessageIgnoringNotModified(() =>
    ctx.editMessageText(text.text, {
      reply_markup: keyboard,
      entities: text.entities,
    })
  );
}

export function clearSyllabusSession(ctx: BotContext): void {
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
  ctx.session.syllabusEnqueuedDownloadKey = null;
  ctx.session.syllabusMessageId = null;
}

function buildDownloadJob(
  ctx: BotContext,
  entry: SyllabusEntry,
  statusMessageId: number
): AttachmentDeliveryJob {
  const data: AttachmentDeliveryJob = {
    chatId: ctx.chat!.id,
    attachments: [
      {
        name: entry.attachmentName!,
        encryptId: entry.encryptAttachmentId!,
        source: "syllabus",
      },
    ],
    statusMessageId,
    context: "syllabus",
    sendViewAnotherMessage: true,
  };
  if (ctx.msgId !== undefined) data.replyToMessageId = ctx.msgId;
  return data;
}

async function showLoading(
  ctx: BotContext,
  message: (typeof MESSAGES)[keyof typeof MESSAGES]
): Promise<void> {
  const text = joinWithNewlines(message, 2);
  await editMessageIgnoringNotModified(() =>
    ctx.editMessageText(text.text, { entities: text.entities })
  );
}

async function showInvalidSelection(ctx: CallbackContext): Promise<void> {
  await editMessageIgnoringNotModified(() =>
    ctx.editMessageText(
      `${emoji("cross_mark")} Invalid selection. Please try again.`
    )
  );
}

export async function previousPage(
  ctx: CallbackContext,
  step: Step
): Promise<void> {
  await changePage(ctx, step, -1);
}

export async function nextPage(
  ctx: CallbackContext,
  step: Step
): Promise<void> {
  await changePage(ctx, step, 1);
}

async function changePage(
  ctx: CallbackContext,
  step: Step,
  direction: -1 | 1
): Promise<void> {
  storeCallbackMessageId(ctx, "syllabusMessageId");
  const state = pageState(ctx, step);
  const atBoundary =
    direction < 0
      ? state.page === LOOKUP_CONFIG.INITIAL_PAGE
      : state.page + 1 >= totalPages(state.itemCount);
  if (atBoundary) {
    await ctx.answerCallbackQuery(
      direction < 0
        ? "You are already on the first page."
        : "You are already on the last page."
    );
    return;
  }
  await ctx.answerCallbackQuery();
  await state.render(state.page + direction);
}

function pageState(
  ctx: CallbackContext,
  step: Step
): {
  page: number;
  itemCount: number;
  render: (page: number) => Promise<void>;
} {
  switch (step) {
    case "program":
      return {
        page: ctx.session.syllabusProgramPage ?? LOOKUP_CONFIG.INITIAL_PAGE,
        itemCount: ctx.session.syllabusPrograms.length,
        render: page => renderPrograms(ctx, ctx.session.syllabusPrograms, page),
      };
    case "scheme":
      return {
        page: ctx.session.syllabusSchemePage ?? LOOKUP_CONFIG.INITIAL_PAGE,
        itemCount: ctx.session.syllabusSchemes.length,
        render: page => renderSchemes(ctx, ctx.session.syllabusSchemes, page),
      };
    case "branch":
      return {
        page: ctx.session.syllabusBranchPage ?? LOOKUP_CONFIG.INITIAL_PAGE,
        itemCount: ctx.session.syllabusBranches.length,
        render: page => renderBranches(ctx, ctx.session.syllabusBranches, page),
      };
    case "entry": {
      const entries = ctx.session.syllabusEntries ?? [];
      return {
        page: ctx.session.syllabusSyllabusPage ?? LOOKUP_CONFIG.INITIAL_PAGE,
        itemCount: getDownloadableEntries(entries).entries.length,
        render: page => renderEntries(ctx, entries, page),
      };
    }
  }
}

export function createSyllabusFlow(deps: SyllabusFlowDeps): SyllabusFlow {
  async function enqueueDownload(
    ctx: CallbackContext,
    entry: SyllabusEntry
  ): Promise<void> {
    const downloadKey = `${entry.encryptAttachmentId}:${entry.attachmentName}`;
    if (ctx.session.syllabusEnqueuedDownloadKey === downloadKey) {
      logger.debug(
        { chatId: ctx.chat?.id, userId: ctx.from?.id },
        "Ignoring duplicate syllabus download"
      );
      return;
    }
    ctx.session.syllabusEnqueuedDownloadKey = downloadKey;
    await deleteMessageSafely(ctx, ctx.callbackQuery.message?.message_id);
    const status = await ctx.reply(
      `${emoji("hourglass_not_done")} Downloading syllabus in the background... This may take a moment!`
    );
    await deps.queueDownload(buildDownloadJob(ctx, entry, status.message_id));
  }

  async function start(ctx: BotContext): Promise<void> {
    clearSyllabusSession(ctx);
    ctx.session.syllabusProgramPage = LOOKUP_CONFIG.INITIAL_PAGE;
    const loadingMessage = joinWithNewlines(MESSAGES.FETCHING_PROGRAMS, 2);
    const status = await ctx.reply(loadingMessage.text, {
      entities: loadingMessage.entities,
    });
    ctx.session.syllabusMessageId = status.message_id;
    const programs = await deps.fetchPrograms();
    const { text, keyboard } = buildProgramsPage(
      programs,
      LOOKUP_CONFIG.INITIAL_PAGE
    );
    ctx.session.syllabusPrograms = programs;
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, text.text, {
      reply_markup: keyboard,
      entities: text.entities,
    });
  }

  async function selectProgram(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();
    storeCallbackMessageId(ctx, "syllabusMessageId");
    const parsed = parseSelectCallback(ctx.callbackQuery.data, CB.PROGRAM);
    if (!parsed.isValid) return showInvalidSelection(ctx);
    const program = findItemById(ctx.session.syllabusPrograms, parsed.id);
    ctx.session.syllabusSelectedProgramId = program.id;
    await showLoading(ctx, MESSAGES.FETCHING_SCHEMES);
    const schemes = await deps.fetchSchemes({ programId: program.id });
    if (schemes.length === 0) {
      await editMessageIgnoringNotModified(() =>
        ctx.editMessageText(
          joinWithNewlines([
            fmt`${emoji("woman_shrugging")} No schemes found for ${b}${program.name}${b}.`,
          ]).text,
          { reply_markup: createViewAnotherKeyboard(CB.VIEW_ANOTHER) }
        )
      );
      return;
    }
    await renderSchemes(ctx, schemes, LOOKUP_CONFIG.INITIAL_PAGE);
  }

  async function selectScheme(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();
    storeCallbackMessageId(ctx, "syllabusMessageId");
    const parsed = parseSelectCallback(ctx.callbackQuery.data, CB.SCHEME);
    if (!parsed.isValid) return showInvalidSelection(ctx);
    const scheme = findItemById(ctx.session.syllabusSchemes, parsed.id);
    ctx.session.syllabusSelectedSchemeId = scheme.id;
    await showLoading(ctx, MESSAGES.FETCHING_BRANCHES);
    const branches = await deps.fetchBranches({ schemeId: scheme.id });
    if (branches.length === 0) {
      await editMessageIgnoringNotModified(() =>
        ctx.editMessageText(
          joinWithNewlines([
            fmt`${emoji("woman_shrugging")} No branches found for ${b}${scheme.scheme}${b}.`,
          ]).text,
          { reply_markup: createViewAnotherKeyboard(CB.VIEW_ANOTHER) }
        )
      );
      return;
    }
    await renderBranches(ctx, branches, LOOKUP_CONFIG.INITIAL_PAGE);
  }

  async function selectBranch(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();
    storeCallbackMessageId(ctx, "syllabusMessageId");
    const parsed = parseSelectCallback(ctx.callbackQuery.data, CB.BRANCH);
    if (!parsed.isValid) return showInvalidSelection(ctx);
    const branch = findItemById(ctx.session.syllabusBranches, parsed.id);
    await showLoading(ctx, MESSAGES.FETCHING_SYLLABUS);
    const entries = await deps.fetchSyllabus({ curriculumId: branch.id });
    const { entries: downloadable } = getDownloadableEntries(entries);
    if (downloadable.length === 0) {
      const text = joinWithNewlines(
        [
          fmt`${emoji("woman_shrugging")} No syllabus uploaded yet for ${b}${branch.branchName}${b}.`,
          fmt`Try another branch or check back later.`,
        ],
        2
      );
      await editMessageIgnoringNotModified(() =>
        ctx.editMessageText(text.text, {
          reply_markup: createViewAnotherKeyboard(CB.VIEW_ANOTHER),
          entities: text.entities,
        })
      );
      return;
    }
    if (downloadable.length === 1)
      return enqueueDownload(ctx, downloadable[0]!);
    await renderEntries(ctx, entries, LOOKUP_CONFIG.INITIAL_PAGE);
  }

  async function selectEntry(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();
    storeCallbackMessageId(ctx, "syllabusMessageId");
    const parsed = parseSelectCallback(ctx.callbackQuery.data, CB.SYLLABUS);
    if (!parsed.isValid) return showInvalidSelection(ctx);
    const entry = (ctx.session.syllabusEntries ?? [])[parsed.id];
    if (
      !entry ||
      entry.encryptAttachmentId === null ||
      entry.attachmentName === null
    )
      return showInvalidSelection(ctx);
    await enqueueDownload(ctx, entry);
  }

  async function restart(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();
    storeCallbackMessageId(ctx, "syllabusMessageId");
    clearSyllabusSession(ctx);
    ctx.session.syllabusProgramPage = LOOKUP_CONFIG.INITIAL_PAGE;
    await showLoading(ctx, MESSAGES.FETCHING_PROGRAMS);
    const programs = await deps.fetchPrograms();
    await renderPrograms(ctx, programs, LOOKUP_CONFIG.INITIAL_PAGE);
  }

  return {
    start,
    selectProgram,
    selectScheme,
    selectBranch,
    selectEntry,
    restart,
  };
}
