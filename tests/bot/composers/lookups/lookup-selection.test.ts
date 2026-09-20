import assert from "node:assert/strict";
import test, { after } from "node:test";
import {
  endTimetableLookup,
  handleTimetableSelection,
} from "../../../../src/bot/composers/lookups/exam-timetable/composer.js";
import {
  endCalendarLookup,
  handleCalendarAttachment,
  handleCalendarSelection,
} from "../../../../src/bot/composers/lookups/academic-calendar/composer.js";
import {
  endAnnouncementsLookup,
  handleAnnouncementAttachments,
  handleAnnouncementSelection,
} from "../../../../src/bot/composers/lookups/announcements/composer.js";
import { attachmentDeliveryQueue } from "../../../../src/workers/attachment-delivery/queue.js";
import type {
  AcademicCalendar,
  Announcement,
  Attachment,
  ExamTimeTable,
} from "../../../../src/types/service.types.js";
import { baseSession, createFakeCtx, ctxCalls } from "../../fakes.js";
import { callbackData } from "../../../helpers.js";
import type { InlineKeyboard } from "grammy";

type QueuedJob = {
  chatId: number;
  attachments: Attachment[];
  statusMessageId?: number;
  replyToMessageId?: number;
  context: string;
  sendViewAnotherMessage?: boolean;
};

// Composer modules import the real attachment-delivery queue, whose Redis
// connection would keep the test process alive. Selection tests inject
// their own queue function instead.
after(async () => {
  await attachmentDeliveryQueue.close();
});

function queueStub() {
  const queued: QueuedJob[] = [];
  return {
    queued,
    queueDownload: async (job: QueuedJob) => {
      queued.push(job);
    },
  };
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
  const { ctx, calls } = createFakeCtx();

  await handleTimetableSelection(
    ctx,
    { ...timetable, attachmentId: null },
    queueDownload
  );

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
  const { ctx, calls } = createFakeCtx({ msgId: 8 });

  await handleTimetableSelection(ctx, timetable, queueDownload);

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
  const details = createFakeCtx();
  await handleCalendarSelection(details.ctx, calendar);
  assert.match(
    ctxCalls(details.calls, "ctx.editMessageText")[0]?.[0] as string,
    /Calendar 2026/
  );

  const { ctx } = createFakeCtx();
  await handleCalendarAttachment(ctx, calendar, queueDownload);
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
  const { ctx, calls } = createFakeCtx();

  await handleAnnouncementSelection(
    ctx,
    announcement([{ name: "a.pdf", encryptId: "enc-a" }])
  );

  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.match(edits[0]?.[0] as string, /Fee notice/);
  assert.match(edits[0]?.[0] as string, /Pay before Friday/);
});

test("announcements without attachments only offer to view another", async () => {
  const { queued, queueDownload } = queueStub();
  const { ctx, calls } = createFakeCtx({
    session: baseSession(),
    callbackData: "announcement_select_81",
  });

  await handleAnnouncementAttachments(ctx, announcement([]), queueDownload);

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
  await endTimetableLookup(endedTimetable.ctx);
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
  await endCalendarLookup(endedCalendar.ctx);
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
  await endAnnouncementsLookup(endedAnnouncements.ctx);
  assert.equal(endedAnnouncements.ctx.session.announcementsPage, null);
  assert.deepEqual(
    endedAnnouncements.ctx.session.announcementsAnnouncements,
    []
  );
  assert.equal(endedAnnouncements.ctx.session.announcementsMessageId, null);
});

test("announcement downloads use singular and plural correctly", async () => {
  const single = queueStub();
  const singleCtx = createFakeCtx();
  await handleAnnouncementAttachments(
    singleCtx.ctx,
    announcement([{ name: "a.pdf", encryptId: "enc-a" }]),
    single.queueDownload
  );
  assert.match(
    ctxCalls(singleCtx.calls, "ctx.reply")[0]?.[0] as string,
    /Downloading your file in the background/
  );
  assert.deepEqual(single.queued[0]?.attachments, [
    { name: "a.pdf", encryptId: "enc-a" },
  ]);
  assert.equal(single.queued[0]?.context, "announcement");

  const double = queueStub();
  const doubleCtx = createFakeCtx();
  await handleAnnouncementAttachments(
    doubleCtx.ctx,
    announcement([
      { name: "a.pdf", encryptId: "enc-a" },
      { name: "b.pdf", encryptId: "enc-b" },
    ]),
    double.queueDownload
  );
  assert.match(
    ctxCalls(doubleCtx.calls, "ctx.reply")[0]?.[0] as string,
    /Downloading your files in the background/
  );
  assert.deepEqual(
    double.queued[0]?.attachments.map(entry => entry.name),
    ["a.pdf", "b.pdf"]
  );
});
