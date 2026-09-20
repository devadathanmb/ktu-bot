import assert from "node:assert/strict";
import test from "node:test";
import type { InlineQueryResult } from "grammy/types";
import {
  parseQuery,
  getSearchTypeFromPrefix,
} from "../../../../src/bot/composers/inline-query/query.js";
import {
  addSearchAgainButton,
  buildHelpResults,
  constructNoResultsFound,
  renderAnnouncementResults,
  renderCalendarResults,
  renderTimetableResults,
} from "../../../../src/bot/composers/inline-query/results.js";
import {
  buildAttachmentDeliveryJob,
  resolveChosenResultAttachments,
  type ChosenResultRepos,
} from "../../../../src/bot/composers/inline-query/chosen-result.js";
import {
  searchAnnouncements,
  searchCalendars,
  searchTimetables,
} from "../../../../src/bot/composers/inline-query/search.js";
import { SearchType } from "../../../../src/bot/composers/inline-query/search-types.js";
import type {
  AcademicCalendar,
  Announcement,
  ExamTimeTable,
} from "../../../../src/types/service.types.js";
import { announcements } from "../../../../src/db/schema/announcements.js";
import { academicCalendars } from "../../../../src/db/schema/academic-calendars.js";
import { examTimetables } from "../../../../src/db/schema/exam-timetables.js";

type AnnouncementRow = typeof announcements.$inferSelect;
type CalendarRow = typeof academicCalendars.$inferSelect;
type TimetableRow = typeof examTimetables.$inferSelect;

const publishedAt = new Date("2026-09-19T00:00:00Z");

function announcementRow(
  overrides: Partial<AnnouncementRow> = {}
): AnnouncementRow {
  return {
    id: 1,
    publishedAt,
    subject: "Fee payment notice",
    message: "Pay the pending fees",
    attachments: [{ fileName: "notice.pdf", encryptId: "enc-1" }],
    searchVector: "",
    createdAt: publishedAt,
    updatedAt: publishedAt,
    ...overrides,
  };
}

function calendarRow(overrides: Partial<CalendarRow> = {}): CalendarRow {
  return {
    id: 2,
    publishedAt,
    title: "Academic calendar 2026",
    attachment: {
      fileName: "calendar.pdf",
      attachmentId: 3,
      encryptId: "enc-2",
    },
    searchVector: "",
    createdAt: publishedAt,
    updatedAt: publishedAt,
    ...overrides,
  };
}

function timetableRow(overrides: Partial<TimetableRow> = {}): TimetableRow {
  return {
    id: 3,
    publishedAt,
    title: "B.Tech timetable",
    attachment: {
      fileName: "timetable.pdf",
      attachmentId: 7,
      encryptId: "enc-3",
    },
    searchVector: "",
    createdAt: publishedAt,
    updatedAt: publishedAt,
    ...overrides,
  };
}

function resultIds(results: InlineQueryResult[]): Array<string | undefined> {
  return results.map(result => result.id);
}

function articleMessageText(result: InlineQueryResult): string {
  if (result.type !== "article") throw new Error("expected an article result");
  const content = result.input_message_content;
  if (!content || !("message_text" in content)) {
    throw new Error("article result has no message text");
  }
  return content.message_text;
}

test("query parsing recognizes prefixes and trims terms", () => {
  assert.deepEqual(parseQuery("ann: fee deadline"), {
    type: SearchType.ANNOUNCEMENTS,
    searchTerm: "fee deadline",
  });
  assert.deepEqual(parseQuery("cal: 2026 "), {
    type: SearchType.CALENDARS,
    searchTerm: "2026",
  });
  assert.deepEqual(parseQuery("  tt:schedule"), {
    type: SearchType.TIMETABLES,
    searchTerm: "schedule",
  });
  assert.deepEqual(parseQuery("ann:"), {
    type: SearchType.ANNOUNCEMENTS,
    searchTerm: "",
  });
  assert.deepEqual(parseQuery("just some words"), {
    type: null,
    searchTerm: "just some words",
  });
  assert.deepEqual(parseQuery(""), { type: null, searchTerm: "" });
});

test("result-ID prefixes map back to search types", () => {
  assert.equal(getSearchTypeFromPrefix("ann"), SearchType.ANNOUNCEMENTS);
  assert.equal(getSearchTypeFromPrefix("cal"), SearchType.CALENDARS);
  assert.equal(getSearchTypeFromPrefix("tt"), SearchType.TIMETABLES);
  assert.equal(getSearchTypeFromPrefix("help"), null);
  assert.equal(getSearchTypeFromPrefix(""), null);
});

test("help results carry fixed IDs for all three resources", () => {
  assert.deepEqual(resultIds(buildHelpResults()), [
    "help_announcements",
    "help_calendars",
    "help_timetables",
  ]);
});

test("no-results IDs are namespaced per resource", () => {
  assert.deepEqual(
    resultIds(constructNoResultsFound(SearchType.ANNOUNCEMENTS)),
    ["no_announcements"]
  );
  assert.deepEqual(resultIds(constructNoResultsFound(SearchType.CALENDARS)), [
    "no_calendars",
  ]);
  assert.deepEqual(resultIds(constructNoResultsFound(SearchType.TIMETABLES)), [
    "no_timetables",
  ]);
});

test("resource results use prefixed record IDs and fall back on empty titles", () => {
  const announcement: Announcement = {
    id: 11,
    subject: "",
    message: "Read carefully",
    publishedAt: null,
    formattedPublishedDate: "19 September 2026",
    attachments: [],
  };
  const rendered = renderAnnouncementResults([announcement]);
  assert.deepEqual(resultIds(rendered), ["ann_11"]);
  assert.equal(rendered[0]?.type, "article");

  assert.deepEqual(
    resultIds(
      renderCalendarResults([
        {
          id: 22,
          title: "Calendar",
          publishedAt: null,
          formattedPublishedDate: "19 September 2026",
          attachmentName: "cal.pdf",
          attachmentId: 3,
          encryptId: "enc",
        } satisfies AcademicCalendar,
      ])
    ),
    ["cal_22"]
  );
  assert.deepEqual(
    resultIds(
      renderTimetableResults([
        {
          id: 33,
          title: "",
          publishedAt: null,
          formattedPublishedDate: "",
          attachmentId: null,
          fileName: null,
          encryptId: null,
        } satisfies ExamTimeTable,
      ])
    ),
    ["tt_33"]
  );

  assert.deepEqual(resultIds(renderAnnouncementResults([])), [
    "no_announcements",
  ]);
  assert.deepEqual(resultIds(renderCalendarResults([])), ["no_calendars"]);
  assert.deepEqual(resultIds(renderTimetableResults([])), ["no_timetables"]);
});

test("rendered announcement text preserves literal content", () => {
  const rendered = renderAnnouncementResults([
    {
      id: 11,
      subject: "Exams <Revised> & Final",
      message: "Read <carefully> & prepare.",
      publishedAt: null,
      formattedPublishedDate: "19 September 2026",
      attachments: [],
    },
  ]);
  const text = articleMessageText(rendered[0]!);
  assert.match(text, /Exams <Revised> & Final/);
  assert.match(text, /Read <carefully> & prepare\./);
});

test("search-again keyboard skips help and no-results items", () => {
  const help = buildHelpResults()[0]!;
  const noResults = constructNoResultsFound(SearchType.ANNOUNCEMENTS)[0]!;
  const article = renderAnnouncementResults([
    {
      id: 11,
      subject: "Subject",
      message: "",
      publishedAt: null,
      formattedPublishedDate: "",
      attachments: [],
    },
  ])[0]!;

  const updated = addSearchAgainButton([help, noResults, article], "ann: fee");

  assert.strictEqual(updated[0], help);
  assert.strictEqual(updated[1], noResults);
  assert.notStrictEqual(updated[2], article);
  assert.ok(
    JSON.stringify(updated[2]).includes("ann: fee"),
    "article carries the original query for searching again"
  );
});

test("blank search terms list all records, terms search with limit 50", async () => {
  const rows = [announcementRow()];
  const calls: Array<{
    method: "search" | "getAll";
    term: string | undefined;
    limit: number | undefined;
  }> = [];
  const repo = {
    search: async (term: string, options?: { limit?: number }) => {
      calls.push({ method: "search", term, limit: options?.limit });
      return rows;
    },
    getAll: async (options?: { limit?: number }) => {
      calls.push({ method: "getAll", term: undefined, limit: options?.limit });
      return rows;
    },
  };

  const fromTerm = await searchAnnouncements("fee", repo);
  assert.deepEqual(resultIds(fromTerm), ["ann_1"]);
  assert.deepEqual(calls, [{ method: "search", term: "fee", limit: 50 }]);

  calls.length = 0;
  const fromBlank = await searchAnnouncements("   ", repo);
  assert.deepEqual(resultIds(fromBlank), ["ann_1"]);
  assert.deepEqual(calls, [{ method: "getAll", term: undefined, limit: 50 }]);

  const emptyRepo = {
    search: async () => [] as AnnouncementRow[],
    getAll: async () => [] as AnnouncementRow[],
  };
  assert.deepEqual(resultIds(await searchAnnouncements("fee", emptyRepo)), [
    "no_announcements",
  ]);
});

test("calendar and timetable searches transform rows into results", async () => {
  const calendars = await searchCalendars("2026", {
    search: async () => [calendarRow()],
    getAll: async () => [],
  });
  assert.deepEqual(resultIds(calendars), ["cal_2"]);

  const timetables = await searchTimetables("", {
    search: async () => [],
    getAll: async () => [timetableRow()],
  });
  assert.deepEqual(resultIds(timetables), ["tt_3"]);

  assert.deepEqual(
    resultIds(
      await searchTimetables("x", {
        search: async () => [],
        getAll: async () => [],
      })
    ),
    ["no_timetables"]
  );
});

function reposWith(
  overrides: Partial<ChosenResultRepos> = {}
): ChosenResultRepos {
  return {
    announcements: { getById: async () => undefined },
    calendars: { getById: async () => undefined },
    timetables: { getById: async () => undefined },
    ...overrides,
  };
}

test("help and no-results IDs resolve to ignored", async () => {
  assert.deepEqual(
    await resolveChosenResultAttachments("help_announcements", reposWith()),
    { status: "ignored" }
  );
  assert.deepEqual(
    await resolveChosenResultAttachments("no_timetables", reposWith()),
    { status: "ignored" }
  );
});

test("ignored IDs resolve without touching repositories", async () => {
  const unreachable = () => {
    throw new Error("repository must not be used");
  };
  assert.deepEqual(
    await resolveChosenResultAttachments("help_announcements", {
      announcements: { getById: unreachable },
      calendars: { getById: unreachable },
      timetables: { getById: unreachable },
    }),
    { status: "ignored" }
  );
});

test("malformed and unknown result IDs explain the problem", async () => {
  for (const resultId of ["ann_", "ann", ""]) {
    const resolution = await resolveChosenResultAttachments(
      resultId,
      reposWith()
    );
    assert.equal(resolution.status, "invalid-format");
    assert.match(
      (resolution as { message: string }).message,
      /Invalid result format/
    );
  }

  const unknown = await resolveChosenResultAttachments("xyz_123", reposWith());
  assert.equal(unknown.status, "unknown-type");
  assert.match(
    (unknown as { message: string }).message,
    /Unknown resource type/
  );
});

test("missing records resolve to resource-specific not-found outcomes", async () => {
  assert.deepEqual(await resolveChosenResultAttachments("ann_9", reposWith()), {
    status: "not-found",
    message: "❌ Announcement not found.",
  });
  assert.deepEqual(await resolveChosenResultAttachments("cal_9", reposWith()), {
    status: "not-found",
    message: "❌ Academic calendar not found.",
  });
  assert.deepEqual(await resolveChosenResultAttachments("tt_9", reposWith()), {
    status: "not-found",
    message: "❌ Exam timetable not found.",
  });
  assert.deepEqual(
    await resolveChosenResultAttachments("ann_abc", reposWith()),
    { status: "not-found", message: "❌ Announcement not found." }
  );
});

test("announcement attachments resolve in order; empty ones report no attachments", async () => {
  const attachments = [
    { fileName: "first.pdf", encryptId: "enc-1" },
    { fileName: "second.pdf", encryptId: "enc-2" },
  ];
  const ready = await resolveChosenResultAttachments(
    "ann_1",
    reposWith({
      announcements: {
        getById: async () => announcementRow({ attachments }),
      },
    })
  );
  assert.deepEqual(ready, {
    status: "ready",
    attachments: [
      { name: "first.pdf", encryptId: "enc-1" },
      { name: "second.pdf", encryptId: "enc-2" },
    ],
    resource: "announcement",
  });

  const empty = await resolveChosenResultAttachments(
    "ann_1",
    reposWith({
      announcements: {
        getById: async () => announcementRow({ attachments: [] }),
      },
    })
  );
  assert.deepEqual(empty, {
    status: "no-attachments",
    message: "ℹ️ No attachments found for this announcement.",
  });
});

test("calendar and timetable resolutions keep attachment semantics", async () => {
  const calendar = await resolveChosenResultAttachments(
    "cal_2",
    reposWith({ calendars: { getById: async () => calendarRow() } })
  );
  assert.deepEqual(calendar, {
    status: "ready",
    attachments: [{ name: "calendar.pdf", encryptId: "enc-2" }],
    resource: "academic calendar",
  });

  const timetable = await resolveChosenResultAttachments(
    "tt_3",
    reposWith({ timetables: { getById: async () => timetableRow() } })
  );
  assert.deepEqual(timetable, {
    status: "ready",
    attachments: [{ name: "timetable.pdf", encryptId: "enc-3" }],
    resource: "exam timetable",
  });

  for (const attachment of [
    { fileName: null, attachmentId: 7, encryptId: "enc-3" },
    { fileName: "timetable.pdf", attachmentId: 7, encryptId: null },
    { fileName: "", attachmentId: 7, encryptId: "" },
  ]) {
    const incomplete = await resolveChosenResultAttachments(
      "tt_3",
      reposWith({
        timetables: { getById: async () => timetableRow({ attachment }) },
      })
    );
    assert.deepEqual(incomplete, {
      status: "no-attachments",
      message: "ℹ️ No attachments found for this exam timetable.",
    });
  }
});

test("queued payload carries chat, attachments, status message, and context", () => {
  const attachments = [{ name: "a.pdf", encryptId: "enc-a" }];
  assert.deepEqual(buildAttachmentDeliveryJob(7, attachments, 99), {
    chatId: 7,
    attachments,
    statusMessageId: 99,
    context: "inline query result",
  });
});
