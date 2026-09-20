import assert from "node:assert/strict";
import test from "node:test";
import { FormattedString } from "@grammyjs/parse-mode";
import {
  AnnouncementFilter,
  UNDERGRADUATE_COURSES,
} from "../../src/constants/courses.js";
import {
  resolveAnnouncementAudience,
  type AnnouncementClassifier,
} from "../../src/workers/announcements/notify/audience.js";
import {
  enqueueNewAnnouncementBroadcasts,
  type AnnouncementNotificationDeps,
} from "../../src/workers/announcements/notify/orchestration.js";
import type {
  Announcement,
  Attachment,
} from "../../src/types/service.types.js";
import type { BroadcastJobInput } from "../../src/workers/broadcasts/queue.js";

const ALL_ANNOUNCEMENT_FILTERS = new Set(Object.values(AnnouncementFilter));

const GENERIC_ANNOUNCEMENT_CONTENT = JSON.stringify({
  subject: "Fee payment notice",
  message: "Pay the pending fees before the deadline",
});

const BROAD_UG_ANNOUNCEMENT_CONTENT = JSON.stringify({
  subject: "UG admissions open",
  message: "Apply before the deadline",
});

const FORMATTED_TEXT = new FormattedString("formatted announcement");

function createAnnouncement(
  overrides: Partial<Announcement> = {}
): Announcement {
  return {
    id: 1,
    subject: "Fee payment notice",
    message: "Pay the pending fees before the deadline",
    formattedPublishedDate: "01 January 2026",
    publishedAt: null,
    attachments: [],
    ...overrides,
  };
}

function createHarness(overrides: Partial<AnnouncementNotificationDeps> = {}) {
  const events: string[] = [];
  const enqueued: BroadcastJobInput[] = [];
  const replaced: number[][] = [];
  const deps: AnnouncementNotificationDeps = {
    findSubscriberChatIds: async () => [],
    processAttachments: async attachments =>
      attachments.map(attachment => ({
        fileName: attachment.name,
        fileId: `file-${attachment.name}`,
      })),
    prepareFormattedText: () => FORMATTED_TEXT,
    enqueueBroadcasts: async jobs => {
      events.push("enqueue");
      enqueued.push(...jobs);
    },
    replaceBuffer: async announcementIds => {
      events.push("replace");
      replaced.push(announcementIds);
    },
    ...overrides,
  };
  return { deps, events, enqueued, replaced };
}

test("no new announcements enqueues nothing and leaves the buffer alone", async () => {
  let subscriberLookups = 0;
  const { deps, events, enqueued, replaced } = createHarness({
    findSubscriberChatIds: async () => {
      subscriberLookups += 1;
      return [1];
    },
  });

  await enqueueNewAnnouncementBroadcasts(
    [createAnnouncement({ id: 10 }), createAnnouncement({ id: 11 })],
    [10, 11],
    deps
  );

  assert.equal(subscriberLookups, 0);
  assert.deepEqual(enqueued, []);
  assert.deepEqual(replaced, []);
  assert.deepEqual(events, []);
});

test("matching subscribers produce deterministic broadcast jobs", async () => {
  const chatIdsByAnnouncement = new Map([
    [42, [100, 200]],
    [43, [300]],
  ]);
  const { deps, enqueued } = createHarness({
    findSubscriberChatIds: async announcement =>
      chatIdsByAnnouncement.get(announcement.id) ?? [],
  });

  await enqueueNewAnnouncementBroadcasts(
    [createAnnouncement({ id: 42 }), createAnnouncement({ id: 43 })],
    [],
    deps
  );

  assert.deepEqual(
    enqueued.map(job => job.jobId),
    [
      "announcement-42-chat-100",
      "announcement-42-chat-200",
      "announcement-43-chat-300",
    ]
  );
  assert.deepEqual(
    enqueued.map(job => job.data.chatId),
    [100, 200, 300]
  );
  assert.ok(enqueued.every(job => job.data.formattedText === FORMATTED_TEXT));
});

test("broadcasts are enqueued before the buffer is replaced", async () => {
  const { deps, events, replaced } = createHarness({
    findSubscriberChatIds: async () => [7],
  });

  await enqueueNewAnnouncementBroadcasts(
    [createAnnouncement({ id: 42 }), createAnnouncement({ id: 43 })],
    [41],
    deps
  );

  assert.deepEqual(events, ["enqueue", "replace"]);
  // The buffer holds every fetched announcement ID, not only the new ones.
  assert.deepEqual(replaced, [[42, 43]]);
});

test("a queue insertion failure leaves the buffer unchanged", async () => {
  let insertionAttempts = 0;
  const { deps, replaced } = createHarness({
    findSubscriberChatIds: async () => [7],
    enqueueBroadcasts: async () => {
      insertionAttempts += 1;
      throw new Error("redis unavailable");
    },
  });

  await assert.rejects(
    enqueueNewAnnouncementBroadcasts(
      [createAnnouncement({ id: 42 })],
      [],
      deps
    ),
    /redis unavailable/
  );

  assert.equal(insertionAttempts, 1);
  assert.deepEqual(replaced, []);
});

test("announcements without subscribers are buffered without broadcasts", async () => {
  const { deps, events, enqueued, replaced } = createHarness({
    findSubscriberChatIds: async () => [],
  });

  await enqueueNewAnnouncementBroadcasts(
    [createAnnouncement({ id: 42 })],
    [],
    deps
  );

  assert.deepEqual(enqueued, []);
  assert.deepEqual(events, ["replace"]);
  assert.deepEqual(replaced, [[42]]);
});

test("attachment processing preserves announcement attachment order", async () => {
  const attachments: Attachment[] = [
    { name: "first.pdf", encryptId: "enc-1" },
    { name: "second.pdf", encryptId: "enc-2" },
    { name: "third.pdf", encryptId: "enc-3" },
  ];
  const attachmentBatches: string[][] = [];
  const { deps, enqueued } = createHarness({
    findSubscriberChatIds: async () => [1, 2],
    processAttachments: async incoming => {
      attachmentBatches.push(incoming.map(attachment => attachment.name));
      return incoming.map(attachment => ({
        fileName: attachment.name,
        fileId: `file-${attachment.name}`,
      }));
    },
  });

  await enqueueNewAnnouncementBroadcasts(
    [createAnnouncement({ id: 42, attachments })],
    [],
    deps
  );

  assert.deepEqual(attachmentBatches, [
    ["first.pdf", "second.pdf", "third.pdf"],
  ]);
  assert.equal(enqueued.length, 2);
  for (const job of enqueued) {
    assert.deepEqual(
      job.data.attachments.map(attachment => attachment.fileName),
      ["first.pdf", "second.pdf", "third.pdf"]
    );
  }
});

test("course-specific announcements skip the LLM and keep their filters", async () => {
  let courseLookups = 0;
  let relevanceChecks = 0;
  const classifier: AnnouncementClassifier = {
    async findRelevantCoursesFromAnnouncement() {
      courseLookups += 1;
      return new Set<AnnouncementFilter>();
    },
    async isAnnouncementRelevant() {
      relevanceChecks += 1;
      return false;
    },
  };

  const audience = await resolveAnnouncementAudience(
    JSON.stringify({
      subject: "B.Tech exam schedule",
      message: "Exam starts soon",
    }),
    classifier,
    async () => {}
  );

  assert.equal(courseLookups, 0);
  assert.equal(relevanceChecks, 0);
  assert.deepEqual(
    audience.filters,
    new Set([
      AnnouncementFilter.BTECH,
      AnnouncementFilter.RELEVANT,
      AnnouncementFilter.ALL,
    ])
  );
  assert.equal(audience.isStudentRelevant, true);
});

test("broad UG filters are narrowed by the LLM course list", async () => {
  let courseLookups = 0;
  const classifier: AnnouncementClassifier = {
    async findRelevantCoursesFromAnnouncement() {
      courseLookups += 1;
      return new Set([AnnouncementFilter.BTECH, AnnouncementFilter.MCA]);
    },
    async isAnnouncementRelevant() {
      throw new Error("relevance check should not run");
    },
  };

  const audience = await resolveAnnouncementAudience(
    BROAD_UG_ANNOUNCEMENT_CONTENT,
    classifier,
    async () => {}
  );

  assert.equal(courseLookups, 1);
  assert.deepEqual(
    audience.filters,
    new Set([
      AnnouncementFilter.BTECH,
      AnnouncementFilter.MCA,
      AnnouncementFilter.RELEVANT,
      AnnouncementFilter.ALL,
    ])
  );
  assert.equal(audience.isStudentRelevant, true);
});

test("a failed LLM course lookup keeps the broad course filters", async () => {
  const classifier: AnnouncementClassifier = {
    async findRelevantCoursesFromAnnouncement() {
      return new Set<AnnouncementFilter>();
    },
    async isAnnouncementRelevant() {
      throw new Error("relevance check should not run");
    },
  };

  const audience = await resolveAnnouncementAudience(
    BROAD_UG_ANNOUNCEMENT_CONTENT,
    classifier,
    async () => {}
  );

  assert.deepEqual(
    audience.filters,
    new Set([
      ...UNDERGRADUATE_COURSES,
      AnnouncementFilter.RELEVANT,
      AnnouncementFilter.ALL,
    ])
  );
  assert.equal(audience.isStudentRelevant, true);
});

test("general announcements use the LLM relevance result for the audience", async () => {
  const sleeps: number[] = [];
  let relevanceChecks = 0;
  const classifier: AnnouncementClassifier = {
    async findRelevantCoursesFromAnnouncement() {
      throw new Error("course lookup should not run");
    },
    async isAnnouncementRelevant() {
      relevanceChecks += 1;
      return true;
    },
  };

  const audience = await resolveAnnouncementAudience(
    GENERIC_ANNOUNCEMENT_CONTENT,
    classifier,
    async milliseconds => {
      sleeps.push(milliseconds);
    }
  );

  assert.equal(relevanceChecks, 1);
  assert.deepEqual(sleeps, [2000]);
  assert.deepEqual(audience.filters, ALL_ANNOUNCEMENT_FILTERS);
  assert.equal(audience.isStudentRelevant, true);
});

test("general announcements the LLM rejects only reach ALL subscribers", async () => {
  const classifier: AnnouncementClassifier = {
    async findRelevantCoursesFromAnnouncement() {
      throw new Error("course lookup should not run");
    },
    async isAnnouncementRelevant() {
      return false;
    },
  };

  const audience = await resolveAnnouncementAudience(
    GENERIC_ANNOUNCEMENT_CONTENT,
    classifier,
    async () => {}
  );

  assert.deepEqual(audience.filters, new Set([AnnouncementFilter.ALL]));
  assert.equal(audience.isStudentRelevant, false);
});
