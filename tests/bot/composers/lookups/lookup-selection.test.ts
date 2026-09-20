import assert from "node:assert/strict";
import test from "node:test";
import { createTimetableFlow } from "../../../../src/bot/composers/lookups/exam-timetable/flow.js";
import { createCalendarFlow } from "../../../../src/bot/composers/lookups/academic-calendar/flow.js";
import { createAnnouncementsFlow } from "../../../../src/bot/composers/lookups/announcements/flow.js";
import type { AttachmentDeliveryJob } from "../../../../src/workers/attachment-delivery/queue.js";
import type {
  AcademicCalendar,
  Announcement,
  Attachment,
  ExamTimeTable,
} from "../../../../src/types/service.types.js";
import { baseSession, createFakeCtx, ctxCalls } from "../../fakes.js";
import { callbackData } from "../../../helpers.js";
import type { InlineKeyboard } from "grammy";

type QueueDownload = (job: AttachmentDeliveryJob) => Promise<unknown>;

function queueStub(): {
  queued: AttachmentDeliveryJob[];
  queueDownload: QueueDownload;
} {
  const queued: AttachmentDeliveryJob[] = [];
  return {
    queued,
    queueDownload: async (job: AttachmentDeliveryJob) => {
      queued.push(job);
    },
  };
}

function createTimetable(queueDownload: QueueDownload) {
  return createTimetableFlow({
    fetchTimetables: async () => [],
    queueDownload,
  });
}

function createCalendar(queueDownload: QueueDownload) {
  return createCalendarFlow({
    fetchCalendars: async () => [],
    queueDownload,
  });
}

function createAnnouncements(queueDownload: QueueDownload) {
  return createAnnouncementsFlow({
    fetchAnnouncements: async () => [],
    queueDownload,
  });
}

const timetable: ExamTimeTable = {
  id: 91,
  attachmentId: 7,
  title: "B.Tech S1 Exams",
  encryptId: "enc-tt",
  fileName: "tt.pdf",
  publishedAt: null,
  formattedPublishedDate: "19 September 2026",
};

const calendar: AcademicCalendar = {
  id: 41,
  title: "Calendar 2026",
  attachmentId: 3,
  encryptId: "enc-cal",
  attachmentName: "cal.pdf",
  publishedAt: null,
  formattedPublishedDate: "20 September 2026",
};

function announcement(attachments: Attachment[]): Announcement {
  return {
    id: 81,
    subject: "Fee notice",
    message: "Pay before Friday",
    publishedAt: null,
    formattedPublishedDate: "20 September 2026",
    attachments,
  };
}

test("timetables without attachments explain instead of queueing", async () => {
  const { queued, queueDownload } = queueStub();
  const flow = createTimetable(queueDownload);
  const { ctx, calls } = createFakeCtx({
    session: baseSession({
      timetableTimetables: [{ ...timetable, attachmentId: null }],
    }),
    callbackData: "timetable_select_91",
  });

  await flow.select(ctx);

  assert.deepEqual(queued, []);
  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.match(edits[0]?.[0] as string, /No attachment found/);
  const keyboard = (edits[0]?.[1] as { reply_markup: InlineKeyboard })
    .reply_markup;
  assert.deepEqual(callbackData(keyboard), [
    "timetable_view_another_true",
    "timetable_view_another_false",
  ]);
});

test("timetables with attachments queue a background download", async () => {
  const { queued, queueDownload } = queueStub();
  const flow = createTimetable(queueDownload);
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ timetableTimetables: [timetable] }),
    msgId: 8,
    callbackData: "timetable_select_91",
  });

  await flow.select(ctx);

  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.match(edits[0]?.[0] as string, /B\.Tech S1 Exams/);
  assert.deepEqual(queued, [
    {
      chatId: 7,
      attachments: [{ name: "tt.pdf", encryptId: "enc-tt" }],
      statusMessageId: 40,
      context: "timetable",
      sendViewAnotherMessage: true,
      replyToMessageId: 8,
    },
  ]);
});

test("calendar selection renders details and queues its attachment", async () => {
  const { queued, queueDownload } = queueStub();
  const flow = createCalendar(queueDownload);
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ calendarCalendars: [calendar] }),
    callbackData: "calendar_select_41",
  });

  await flow.select(ctx);

  assert.match(
    ctxCalls(calls, "ctx.editMessageText")[0]?.[0] as string,
    /Calendar 2026/
  );
  assert.deepEqual(queued, [
    {
      chatId: 7,
      attachments: [{ name: "cal.pdf", encryptId: "enc-cal" }],
      statusMessageId: 40,
      context: "calendar",
      sendViewAnotherMessage: true,
    },
  ]);
});

test("announcement selection renders the full message", async () => {
  const flow = createAnnouncements(async () => {});
  const { ctx, calls } = createFakeCtx({
    session: baseSession({
      announcementsAnnouncements: [
        announcement([{ name: "a.pdf", encryptId: "enc-a" }]),
      ],
    }),
    callbackData: "announcement_select_81",
  });

  await flow.select(ctx);

  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.match(edits[0]?.[0] as string, /Fee notice/);
  assert.match(edits[0]?.[0] as string, /Pay before Friday/);
});

test("announcements without attachments only offer to view another", async () => {
  const { queued, queueDownload } = queueStub();
  const flow = createAnnouncements(queueDownload);
  const { ctx, calls } = createFakeCtx({
    session: baseSession({
      announcementsAnnouncements: [announcement([])],
    }),
    callbackData: "announcement_select_81",
  });

  await flow.select(ctx);

  assert.deepEqual(queued, []);
  const replies = ctxCalls(calls, "ctx.reply");
  assert.match(replies[0]?.[0] as string, /View another announcement\?/);
  const keyboard = (replies[0]?.[1] as { reply_markup: InlineKeyboard })
    .reply_markup;
  assert.deepEqual(callbackData(keyboard), [
    "announcement_view_another_true",
    "announcement_view_another_false",
  ]);
});

test("ending a lookup clears its session state", async () => {
  const endedTimetable = createFakeCtx({
    session: baseSession({
      timetablePage: 2,
      timetableTimetables: [timetable],
      timetableMessageId: 9,
    }),
  });
  await createTimetable(async () => {}).end(endedTimetable.ctx);
  assert.equal(endedTimetable.ctx.session.timetablePage, null);
  assert.deepEqual(endedTimetable.ctx.session.timetableTimetables, []);
  assert.equal(endedTimetable.ctx.session.timetableMessageId, null);
  assert.match(
    ctxCalls(endedTimetable.calls, "ctx.editMessageText")[0]?.[0] as string,
    /Timetable lookup ended/
  );

  const endedCalendar = createFakeCtx({
    session: baseSession({
      calendarPage: 1,
      calendarCalendars: [calendar],
      calendarMessageId: 9,
    }),
  });
  await createCalendar(async () => {}).end(endedCalendar.ctx);
  assert.equal(endedCalendar.ctx.session.calendarPage, null);
  assert.deepEqual(endedCalendar.ctx.session.calendarCalendars, []);
  assert.equal(endedCalendar.ctx.session.calendarMessageId, null);

  const endedAnnouncements = createFakeCtx({
    session: baseSession({
      announcementsPage: 3,
      announcementsAnnouncements: [announcement([])],
      announcementsMessageId: 9,
    }),
  });
  await createAnnouncements(async () => {}).end(endedAnnouncements.ctx);
  assert.equal(endedAnnouncements.ctx.session.announcementsPage, null);
  assert.deepEqual(
    endedAnnouncements.ctx.session.announcementsAnnouncements,
    []
  );
  assert.equal(endedAnnouncements.ctx.session.announcementsMessageId, null);
});

test("announcement downloads use singular and plural correctly", async () => {
  const single = queueStub();
  const singleFlow = createAnnouncements(single.queueDownload);
  const singleCtx = createFakeCtx({
    session: baseSession({
      announcementsAnnouncements: [
        announcement([{ name: "a.pdf", encryptId: "enc-a" }]),
      ],
    }),
    callbackData: "announcement_select_81",
  });
  await singleFlow.select(singleCtx.ctx);
  assert.match(
    ctxCalls(singleCtx.calls, "ctx.reply")[0]?.[0] as string,
    /Downloading your file in the background/
  );
  assert.deepEqual(single.queued[0]?.attachments, [
    { name: "a.pdf", encryptId: "enc-a" },
  ]);
  assert.equal(single.queued[0]?.context, "announcement");

  const double = queueStub();
  const doubleFlow = createAnnouncements(double.queueDownload);
  const doubleCtx = createFakeCtx({
    session: baseSession({
      announcementsAnnouncements: [
        announcement([
          { name: "a.pdf", encryptId: "enc-a" },
          { name: "b.pdf", encryptId: "enc-b" },
        ]),
      ],
    }),
    callbackData: "announcement_select_81",
  });
  await doubleFlow.select(doubleCtx.ctx);
  assert.match(
    ctxCalls(doubleCtx.calls, "ctx.reply")[0]?.[0] as string,
    /Downloading your files in the background/
  );
  assert.deepEqual(
    double.queued[0]?.attachments.map(entry => entry.name),
    ["a.pdf", "b.pdf"]
  );
});

test("flow start fetches the first page and renders it in place", async () => {
  const fetched: number[] = [];
  const flow = createTimetableFlow({
    fetchTimetables: async ({ pageNumber }) => {
      fetched.push(pageNumber);
      return [timetable];
    },
    queueDownload: async () => {},
  });
  const { ctx, calls } = createFakeCtx();

  await flow.start(ctx);

  assert.deepEqual(fetched, [0]);
  assert.equal(ctx.session.timetablePage, 0);
  assert.deepEqual(ctx.session.timetableTimetables, [timetable]);
  const loading = ctxCalls(calls, "ctx.reply")[0];
  assert.match(loading?.[0] as string, /Fetching timetables/);
  const apiEdits = ctxCalls(calls, "api.editMessageText");
  assert.deepEqual(apiEdits[0]?.slice(0, 2), [7, 40]);
  assert.match(apiEdits[0]?.[2] as string, /B\.Tech S1 Exams/);
});

test("view-another resets to the first page and refetches", async () => {
  const fetched: number[] = [];
  const flow = createCalendarFlow({
    fetchCalendars: async ({ pageNumber }) => {
      fetched.push(pageNumber);
      return [calendar];
    },
    queueDownload: async () => {},
  });
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ calendarPage: 3 }),
    callbackData: "calendar_view_another_true",
  });

  await flow.viewAnother(ctx);

  assert.deepEqual(fetched, [0]);
  assert.equal(ctx.session.calendarPage, 0);
  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.match(edits.at(-1)?.[0] as string, /Calendar 2026/);
});
