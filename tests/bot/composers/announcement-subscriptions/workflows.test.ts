import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAnnouncementFilters,
  unsubscribeFromAnnouncements,
} from "../../../../src/bot/composers/announcement-subscriptions/workflows.js";
import { SessionNotFoundError } from "../../../../src/errors/index.js";
import { baseSession, createFakeCtx, ctxCalls } from "../../fakes.js";

test("applying filters persists before confirming and clears the session after", async () => {
  const { ctx, calls } = createFakeCtx({
    session: baseSession({
      announcementSubscriptionMessageId: 3,
      selectedFilters: ["BTECH"],
    }),
    callbackData: "announcement_apply_filters",
  });

  let editsAtPersist = -1;
  await applyAnnouncementFilters(ctx, async (chatId, filters) => {
    editsAtPersist = ctxCalls(calls, "api.editMessageText").length;
    assert.equal(chatId, 7);
    assert.deepEqual(filters, ["BTECH"]);
    return "updated";
  });

  assert.equal(editsAtPersist, 0);
  const edits = ctxCalls(calls, "api.editMessageText");
  assert.deepEqual(edits.length, 1);
  assert.deepEqual(edits[0]?.slice(0, 2), [7, 3]);
  assert.match(
    edits[0]?.[2] as string,
    /Your announcement filters have been updated successfully/
  );
  assert.deepEqual(ctx.session.selectedFilters, []);
  assert.equal(ctx.session.announcementSubscriptionMessageId, null);
});

test("applying filters confirms the created filters by name", async () => {
  const { ctx, calls } = createFakeCtx({
    session: baseSession({
      announcementSubscriptionMessageId: 3,
      selectedFilters: ["BTECH", "MCA"],
    }),
    callbackData: "announcement_apply_filters",
  });

  await applyAnnouncementFilters(ctx, async () => "created");

  const edit = ctxCalls(calls, "api.editMessageText")[0];
  assert.match(edit?.[2] as string, /Successfully subscribed/);
  assert.match(edit?.[2] as string, /B\.Tech, MCA/);
  assert.deepEqual(ctx.session.selectedFilters, []);
});

test("a failed filter persist sends no confirmation and keeps the session", async () => {
  const { ctx, calls } = createFakeCtx({
    session: baseSession({
      announcementSubscriptionMessageId: 3,
      selectedFilters: ["BTECH"],
    }),
    callbackData: "announcement_apply_filters",
  });

  await assert.rejects(
    applyAnnouncementFilters(ctx, async () => {
      throw new Error("database unavailable");
    }),
    /database unavailable/
  );

  assert.equal(ctxCalls(calls, "api.editMessageText").length, 0);
  assert.deepEqual(ctx.session.selectedFilters, ["BTECH"]);
  assert.equal(ctx.session.announcementSubscriptionMessageId, 3);
});

test("a Telegram failure after the filter write propagates without rolling back the session", async () => {
  const { ctx, calls } = createFakeCtx({
    session: baseSession({
      announcementSubscriptionMessageId: 3,
      selectedFilters: ["BTECH"],
    }),
    callbackData: "announcement_apply_filters",
    apiEditMessageTextError: new Error("telegram unavailable"),
  });

  let persisted = 0;
  await assert.rejects(
    applyAnnouncementFilters(ctx, async () => {
      persisted += 1;
      return "created";
    }),
    /telegram unavailable/
  );

  assert.equal(persisted, 1);
  // Only the failed success edit was attempted; no inverse message follows.
  assert.equal(ctxCalls(calls, "api.editMessageText").length, 1);
  assert.deepEqual(ctx.session.selectedFilters, ["BTECH"]);
  assert.equal(ctx.session.announcementSubscriptionMessageId, 3);
});

test("applying without a selection asks again and never persists", async () => {
  const { ctx, calls } = createFakeCtx({
    session: baseSession({
      announcementSubscriptionMessageId: 3,
      selectedFilters: [],
    }),
    callbackData: "announcement_apply_filters",
  });

  let persisted = false;
  await applyAnnouncementFilters(ctx, async () => {
    persisted = true;
    return "updated";
  });

  assert.equal(persisted, false);
  assert.match(
    ctxCalls(calls, "api.editMessageText")[0]?.[2] as string,
    /Please select at least one filter/
  );
});

test("applying without a tracked message fails before persisting", async () => {
  const { ctx } = createFakeCtx({
    session: baseSession({ selectedFilters: ["BTECH"] }),
    callbackData: "announcement_apply_filters",
  });

  let persisted = false;
  await assert.rejects(
    applyAnnouncementFilters(ctx, async () => {
      persisted = true;
      return "updated";
    }),
    SessionNotFoundError
  );
  assert.equal(persisted, false);
});

test("unsubscribing deletes before sending the success reply", async () => {
  const { ctx, calls } = createFakeCtx();

  let repliesAtDelete = -1;
  await unsubscribeFromAnnouncements(ctx, async chatId => {
    repliesAtDelete = ctxCalls(calls, "ctx.reply").length;
    assert.equal(chatId, 7);
    return true;
  });

  assert.equal(repliesAtDelete, 0);
  const replies = ctxCalls(calls, "ctx.reply");
  assert.deepEqual(replies.length, 1);
  assert.match(
    replies[0]?.[0] as string,
    /You have been successfully unsubscribed from announcements/
  );
});

test("unsubscribing without a subscription reports it instead of a success", async () => {
  const { ctx, calls } = createFakeCtx();

  await unsubscribeFromAnnouncements(ctx, async () => false);

  const replies = ctxCalls(calls, "ctx.reply");
  assert.deepEqual(replies.length, 1);
  assert.match(replies[0]?.[0] as string, /You are not subscribed/);
  assert.doesNotMatch(replies[0]?.[0] as string, /successfully unsubscribed/);
});

test("a failed unsubscribe delete sends no reply", async () => {
  const { ctx, calls } = createFakeCtx();

  await assert.rejects(
    unsubscribeFromAnnouncements(ctx, async () => {
      throw new Error("database unavailable");
    }),
    /database unavailable/
  );

  assert.equal(ctxCalls(calls, "ctx.reply").length, 0);
});

test("a Telegram failure after the delete propagates without an inverse reply", async () => {
  const { ctx, calls } = createFakeCtx({
    replyError: new Error("telegram unavailable"),
  });

  let deletes = 0;
  await assert.rejects(
    unsubscribeFromAnnouncements(ctx, async () => {
      deletes += 1;
      return true;
    }),
    /telegram unavailable/
  );

  assert.equal(deletes, 1);
  // Only the failed success reply was attempted; nothing suggests a rollback.
  assert.equal(ctxCalls(calls, "ctx.reply").length, 1);
});
