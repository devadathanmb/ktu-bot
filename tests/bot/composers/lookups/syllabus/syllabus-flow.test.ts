import assert from "node:assert/strict";
import test from "node:test";
import type {
  Branch,
  Program,
  Scheme,
  SyllabusEntry,
} from "../../../../../src/types/service.types.js";
import {
  clearSyllabusSession,
  createSyllabusFlow,
  nextPage,
  previousPage,
  type SyllabusFlow,
  type SyllabusFlowDeps,
} from "../../../../../src/bot/composers/lookups/syllabus/flow.js";
import { SessionNotFoundError } from "../../../../../src/errors/bot-errors.js";
import type { AttachmentDeliveryJob } from "../../../../../src/workers/attachment-delivery/queue.js";
import { baseSession, createFakeCtx, ctxCalls } from "../../../fakes.js";
import { callbackData } from "../../../../helpers.js";
import type { InlineKeyboard } from "grammy";

const programs: Program[] = [
  { id: 100, name: "B.Tech", description: "UG" },
  { id: 101, name: "M.Tech", description: "PG" },
];

const schemes: Scheme[] = [
  {
    id: 42,
    scheme: "2024 Scheme",
    academicYear: "2024",
    programTypeName: "UG",
  },
];

const branches: Branch[] = [
  {
    id: 73,
    branchName: "Computer Science",
    schemeName: "2024",
    programTypeName: "UG",
    academicYear: "2024",
  },
];

function entry(overrides: Partial<SyllabusEntry> = {}): SyllabusEntry {
  return {
    attachmentId: 1,
    encryptAttachmentId: "enc-1",
    attachmentName: "S1.pdf",
    description: "Sem 1",
    ...overrides,
  };
}

const deadEntry: SyllabusEntry = entry({
  encryptAttachmentId: null,
  attachmentName: null,
});

type QueuedJob = AttachmentDeliveryJob;

function stubFlow(overrides: Partial<SyllabusFlowDeps> = {}): {
  flow: SyllabusFlow;
  queued: QueuedJob[];
  fetched: string[];
} {
  const queued: QueuedJob[] = [];
  const fetched: string[] = [];
  const flow = createSyllabusFlow({
    fetchPrograms:
      overrides.fetchPrograms ??
      (async () => {
        fetched.push("programs");
        return programs;
      }),
    fetchSchemes:
      overrides.fetchSchemes ??
      (async () => {
        fetched.push("schemes");
        return schemes;
      }),
    fetchBranches:
      overrides.fetchBranches ??
      (async () => {
        fetched.push("branches");
        return branches;
      }),
    fetchSyllabus:
      overrides.fetchSyllabus ??
      (async () => {
        fetched.push("syllabus");
        return [entry()];
      }),
    queueDownload:
      overrides.queueDownload ??
      (async job => {
        queued.push(job);
      }),
  });
  return { flow, queued, fetched };
}

test("start loads programs into a fresh session", async () => {
  const { flow, fetched } = stubFlow();
  const { ctx, calls } = createFakeCtx();

  await flow.start(ctx);

  assert.deepEqual(fetched, ["programs"]);
  assert.deepEqual(ctx.session.syllabusPrograms, programs);
  assert.equal(ctx.session.syllabusProgramPage, 0);
  assert.equal(ctxCalls(calls, "ctx.reply").length, 1);
  const apiEdits = ctxCalls(calls, "api.editMessageText");
  assert.equal(apiEdits.length, 1);
  assert.deepEqual(apiEdits[0]?.slice(0, 2), [7, 40]);
  assert.match(apiEdits[0]?.[2] as string, /B\.Tech/);
});

test("start clears stale lookup state", async () => {
  const { flow } = stubFlow();
  const { ctx } = createFakeCtx({
    session: baseSession({
      syllabusSchemes: schemes,
      syllabusEntries: [entry()],
      syllabusSelectedProgramId: 100,
      syllabusMessageId: 3,
    }),
  });

  await flow.start(ctx);

  assert.deepEqual(ctx.session.syllabusSchemes, []);
  assert.deepEqual(ctx.session.syllabusEntries, []);
  assert.equal(ctx.session.syllabusSelectedProgramId, null);
});

test("selectProgram renders the schemes for the chosen program", async () => {
  const { flow, fetched } = stubFlow();
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ syllabusPrograms: programs }),
    callbackData: "syllabusprog_select_100",
    callbackMessageId: 3,
  });

  await flow.selectProgram(ctx);

  assert.deepEqual(fetched, ["schemes"]);
  assert.deepEqual(ctx.session.syllabusSchemes, schemes);
  assert.equal(ctx.session.syllabusSelectedProgramId, 100);
  assert.equal(ctx.session.syllabusMessageId, 3);
  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.equal(edits.length, 2);
  assert.match(edits.at(-1)?.[0] as string, /2024 Scheme/);
});

test("selectProgram rejects callbacks outside the program namespace", async () => {
  const { flow, fetched } = stubFlow();
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ syllabusPrograms: programs }),
    callbackData: "syllabusbranch_select_73",
  });

  await flow.selectProgram(ctx);

  assert.deepEqual(fetched, []);
  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.match(edits[0]?.[0] as string, /Invalid selection/);
});

test("selectProgram surfaces a missing session item instead of guessing", async () => {
  const { flow } = stubFlow();
  const { ctx } = createFakeCtx({
    session: baseSession({ syllabusPrograms: [] }),
    callbackData: "syllabusprog_select_100",
  });

  await assert.rejects(flow.selectProgram(ctx), SessionNotFoundError);
});

test("selectProgram with no schemes offers to view another", async () => {
  const { flow } = stubFlow({ fetchSchemes: async () => [] });
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ syllabusPrograms: programs }),
    callbackData: "syllabusprog_select_100",
  });

  await flow.selectProgram(ctx);

  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.match(edits.at(-1)?.[0] as string, /No schemes found for/);
  assert.match(edits.at(-1)?.[0] as string, /B\.Tech/);
  const keyboard = (edits.at(-1)?.[1] as { reply_markup: InlineKeyboard })
    .reply_markup;
  assert.deepEqual(callbackData(keyboard), [
    "syllabus_view_another_true",
    "syllabus_view_another_false",
  ]);
});

test("selectBranch queues a lone syllabus without listing it", async () => {
  const { flow, queued } = stubFlow({
    fetchSyllabus: async () => [deadEntry, entry()],
  });
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ syllabusBranches: branches }),
    callbackData: "syllabusbranch_select_73",
    msgId: 8,
  });

  await flow.selectBranch(ctx);

  assert.deepEqual(queued, [
    {
      chatId: 7,
      attachments: [{ name: "S1.pdf", encryptId: "enc-1", source: "syllabus" }],
      statusMessageId: 40,
      context: "syllabus",
      sendViewAnotherMessage: true,
      replyToMessageId: 8,
    },
  ]);
  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.equal(edits.length, 1);
  assert.match(
    edits[0]?.[0] as string,
    /Fetching syllabus/,
    "only the loading message is edited; no entries page is rendered"
  );
});

test("selectBranch omits the reply target outside message context", async () => {
  const { flow, queued } = stubFlow({
    fetchSyllabus: async () => [entry()],
  });
  const { ctx } = createFakeCtx({
    session: baseSession({ syllabusBranches: branches }),
    callbackData: "syllabusbranch_select_73",
  });

  await flow.selectBranch(ctx);

  assert.equal("replyToMessageId" in (queued[0] ?? {}), false);
});

test("selectBranch renders entries when several are downloadable", async () => {
  const { flow, queued } = stubFlow({
    fetchSyllabus: async () => [
      entry({ attachmentName: "S1.pdf" }),
      entry({ attachmentName: "S2.pdf" }),
    ],
  });
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ syllabusBranches: branches }),
    callbackData: "syllabusbranch_select_73",
  });

  await flow.selectBranch(ctx);

  assert.deepEqual(queued, []);
  assert.deepEqual(ctx.session.syllabusEntries.length, 2);
  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.match(edits.at(-1)?.[0] as string, /S1\.pdf/);
  assert.match(edits.at(-1)?.[0] as string, /S2\.pdf/);
});

test("selectBranch with nothing downloadable offers to view another", async () => {
  const { flow } = stubFlow({ fetchSyllabus: async () => [deadEntry] });
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ syllabusBranches: branches }),
    callbackData: "syllabusbranch_select_73",
  });

  await flow.selectBranch(ctx);

  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.match(edits.at(-1)?.[0] as string, /No syllabus uploaded yet/);
  const keyboard = (edits.at(-1)?.[1] as { reply_markup: InlineKeyboard })
    .reply_markup;
  assert.deepEqual(callbackData(keyboard), [
    "syllabus_view_another_true",
    "syllabus_view_another_false",
  ]);
});

test("selectEntry downloads by original response index", async () => {
  const { flow, queued } = stubFlow();
  const { ctx } = createFakeCtx({
    session: baseSession({ syllabusEntries: [deadEntry, entry()] }),
    callbackData: "syllabusentry_select_1",
  });

  await flow.selectEntry(ctx);

  assert.equal(queued.length, 1);
  assert.deepEqual(queued[0]?.attachments, [
    { name: "S1.pdf", encryptId: "enc-1", source: "syllabus" },
  ]);
});

test("selectScheme renders branches and handles empty results", async () => {
  const { flow, fetched } = stubFlow();
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ syllabusSchemes: schemes }),
    callbackData: "syllabusscheme_select_42",
  });

  await flow.selectScheme(ctx);

  assert.deepEqual(fetched, ["branches"]);
  assert.deepEqual(ctx.session.syllabusBranches, branches);
  assert.equal(ctx.session.syllabusSelectedSchemeId, 42);
  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.match(edits.at(-1)?.[0] as string, /Computer Science/);

  const empty = stubFlow({ fetchBranches: async () => [] });
  const noBranches = createFakeCtx({
    session: baseSession({ syllabusSchemes: schemes }),
    callbackData: "syllabusscheme_select_42",
  });
  await empty.flow.selectScheme(noBranches.ctx);
  const emptyEdits = ctxCalls(noBranches.calls, "ctx.editMessageText");
  assert.match(emptyEdits.at(-1)?.[0] as string, /No branches found for/);
  const emptyKeyboard = (
    emptyEdits.at(-1)?.[1] as { reply_markup: InlineKeyboard }
  ).reply_markup;
  assert.deepEqual(callbackData(emptyKeyboard), [
    "syllabus_view_another_true",
    "syllabus_view_another_false",
  ]);
});

test("selectEntry ignores a null attachmentId when download fields are present", async () => {
  const downloadable = entry({ attachmentId: null });
  const { flow, queued } = stubFlow();
  const { ctx } = createFakeCtx({
    session: baseSession({ syllabusEntries: [downloadable] }),
    callbackData: "syllabusentry_select_0",
  });

  await flow.selectEntry(ctx);

  assert.equal(queued.length, 1);
  assert.deepEqual(queued[0]?.attachments, [
    { name: "S1.pdf", encryptId: "enc-1", source: "syllabus" },
  ]);
});

test("selectEntry rejects entries without attachments", async () => {
  const { flow, queued } = stubFlow();
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ syllabusEntries: [deadEntry] }),
    callbackData: "syllabusentry_select_0",
  });

  await flow.selectEntry(ctx);

  assert.deepEqual(queued, []);
  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.match(edits[0]?.[0] as string, /Invalid selection/);
});

test("selectEntry still queues when the lookup message is already gone", async () => {
  const { flow, queued } = stubFlow();
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ syllabusEntries: [entry()] }),
    callbackData: "syllabusentry_select_0",
    apiDeleteError: new Error("message to delete not found"),
  });

  await flow.selectEntry(ctx);

  assert.equal(queued.length, 1);
  assert.ok(
    calls.some(call => call.method === "api.deleteMessage"),
    "the delete was attempted and its failure swallowed"
  );
});

test("page turns stop at the first and last page", async () => {
  const eleven = Array.from({ length: 11 }, (_, index) => ({
    id: 100 + index,
    name: `Program ${index}`,
    description: null,
  }));
  const first = createFakeCtx({
    session: baseSession({
      syllabusPrograms: eleven,
      syllabusProgramPage: 0,
    }),
    callbackData: "syllabusprog_prev_page",
  });
  await previousPage(first.ctx, "program");
  assert.deepEqual(ctxCalls(first.calls, "ctx.answerCallbackQuery"), [
    ["You are already on the first page."],
  ]);

  const second = createFakeCtx({
    session: baseSession({
      syllabusPrograms: eleven,
      syllabusProgramPage: 0,
    }),
    callbackData: "syllabusprog_next_page",
  });
  await nextPage(second.ctx, "program");
  assert.equal(second.ctx.session.syllabusProgramPage, 1);
  const edits = ctxCalls(second.calls, "ctx.editMessageText");
  assert.match(edits[0]?.[0] as string, /Program 10/);

  const last = createFakeCtx({
    session: baseSession({
      syllabusPrograms: eleven,
      syllabusProgramPage: 1,
    }),
    callbackData: "syllabusprog_next_page",
  });
  await nextPage(last.ctx, "program");
  assert.deepEqual(ctxCalls(last.calls, "ctx.answerCallbackQuery"), [
    ["You are already on the last page."],
  ]);
});

test("page turns work for scheme and filtered entry lists", async () => {
  const elevenSchemes = Array.from({ length: 11 }, (_, index) => ({
    id: 40 + index,
    scheme: `Scheme ${index}`,
    academicYear: "2024",
    programTypeName: "UG",
  }));
  const schemeCtx = createFakeCtx({
    session: baseSession({
      syllabusSchemes: elevenSchemes,
      syllabusSchemePage: 0,
    }),
    callbackData: "syllabusscheme_next_page",
  });
  await nextPage(schemeCtx.ctx, "scheme");
  assert.equal(schemeCtx.ctx.session.syllabusSchemePage, 1);
  assert.match(
    ctxCalls(schemeCtx.calls, "ctx.editMessageText").at(-1)?.[0] as string,
    /Scheme 10/
  );

  const elevenBranches = Array.from({ length: 11 }, (_, index) => ({
    id: 70 + index,
    branchName: `Branch ${index}`,
    schemeName: "2024",
    programTypeName: "UG",
    academicYear: "2024",
  }));
  const branchCtx = createFakeCtx({
    session: baseSession({
      syllabusBranches: elevenBranches,
      syllabusBranchPage: 0,
    }),
    callbackData: "syllabusbranch_next_page",
  });
  await nextPage(branchCtx.ctx, "branch");
  assert.equal(branchCtx.ctx.session.syllabusBranchPage, 1);
  assert.match(
    ctxCalls(branchCtx.calls, "ctx.editMessageText").at(-1)?.[0] as string,
    /Branch 10/
  );

  // Entry pagination counts downloadable entries, not the raw response.
  const mixed = [
    entry({ attachmentName: null, encryptAttachmentId: null }),
    ...Array.from({ length: 11 }, (_, index) =>
      entry({ attachmentName: `S${index}.pdf` })
    ),
  ];
  const entryCtx = createFakeCtx({
    session: baseSession({
      syllabusEntries: mixed,
      syllabusSyllabusPage: 0,
    }),
    callbackData: "syllabusentry_next_page",
  });
  await nextPage(entryCtx.ctx, "entry");
  assert.equal(entryCtx.ctx.session.syllabusSyllabusPage, 1);
  assert.match(
    ctxCalls(entryCtx.calls, "ctx.editMessageText").at(-1)?.[0] as string,
    /S10\.pdf/
  );

  // The discriminator: 1 dead + 10 live is exactly one downloadable page,
  // so the entry list must refuse to turn even though the raw response
  // holds 11 items.
  const exact = createFakeCtx({
    session: baseSession({
      syllabusEntries: [
        entry({ attachmentName: null, encryptAttachmentId: null }),
        ...Array.from({ length: 10 }, (_, index) =>
          entry({ attachmentName: `E${index}.pdf` })
        ),
      ],
      syllabusSyllabusPage: 0,
    }),
    callbackData: "syllabusentry_next_page",
  });
  await nextPage(exact.ctx, "entry");
  assert.equal(exact.ctx.session.syllabusSyllabusPage, 0);
  assert.deepEqual(ctxCalls(exact.calls, "ctx.answerCallbackQuery"), [
    ["You are already on the last page."],
  ]);
});

test("restart clears the session and reloads programs", async () => {
  const { flow, fetched } = stubFlow();
  const { ctx } = createFakeCtx({
    session: baseSession({
      syllabusPrograms: [],
      syllabusSchemes: schemes,
      syllabusSelectedProgramId: 100,
    }),
    callbackData: "syllabus_view_another_true",
  });

  await flow.restart(ctx);

  assert.deepEqual(fetched, ["programs"]);
  assert.deepEqual(ctx.session.syllabusPrograms, programs);
  assert.deepEqual(ctx.session.syllabusSchemes, []);
  assert.equal(ctx.session.syllabusSelectedProgramId, null);
});

test("clearSyllabusSession resets every syllabus key", () => {
  const { ctx } = createFakeCtx({
    session: baseSession({
      syllabusProgramPage: 2,
      syllabusSchemePage: 1,
      syllabusBranchPage: 1,
      syllabusSyllabusPage: 1,
      syllabusPrograms: programs,
      syllabusSchemes: schemes,
      syllabusBranches: branches,
      syllabusEntries: [entry()],
      syllabusSelectedProgramId: 100,
      syllabusSelectedSchemeId: 42,
      syllabusMessageId: 9,
    }),
  });

  clearSyllabusSession(ctx);

  assert.deepEqual(ctx.session, baseSession());
});
