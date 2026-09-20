import assert from "node:assert/strict";
import test from "node:test";
import { BotError as GrammyBotError, type NextFunction } from "grammy";
import {
  createComposerErrorBoundary,
  createSyllabusErrorBoundary,
} from "../../../../src/bot/composers/shared/error-boundary.js";
import { createSyllabusFlow } from "../../../../src/bot/composers/lookups/syllabus/flow.js";
import { HandledBotError } from "../../../../src/errors/handled-bot-error.js";
import {
  KTUAPIError,
  SessionNotFoundError,
} from "../../../../src/errors/bot-errors.js";
import {
  baseSession,
  createFakeCtx,
  ctxCalls,
  type FakeCtx,
} from "../../fakes.js";

const next = (async () => {}) as unknown as NextFunction;

async function runBoundary(
  boundary: ReturnType<typeof createSyllabusErrorBoundary>,
  error: unknown,
  ctx: FakeCtx
): Promise<unknown> {
  return boundary(new GrammyBotError(error, ctx), next).then(
    () => {
      throw new Error("boundary should have rethrown");
    },
    (handled: unknown) => handled
  );
}

function syllabusCtx(messageId: number | null) {
  return createFakeCtx({
    session: baseSession({ syllabusMessageId: messageId }),
    callbackData: "syllabusprog_select_100",
    callbackMessageId: 3,
  });
}

test("KTU errors reach the user and clear the loading message", async () => {
  const boundary = createSyllabusErrorBoundary();
  const ktuError = new KTUAPIError(
    "fetchPrograms",
    "backend exploded",
    "KTU API is busy. Please try again after sometime."
  );
  const { ctx, calls } = syllabusCtx(5);

  const handled = (await runBoundary(
    boundary,
    ktuError,
    ctx
  )) as HandledBotError;

  assert.ok(handled instanceof HandledBotError);
  assert.strictEqual(handled.originalError, ktuError);
  assert.equal(handled.handledBy, "composer-error-boundary");
  assert.equal(handled.userNotified, true);
  assert.deepEqual(handled.cleanupActions, [
    "deleted-loading-message-syllabusMessageId",
  ]);

  const replies = ctxCalls(calls, "ctx.reply");
  assert.equal(
    replies[0]?.[0],
    "KTU API is busy. Please try again after sometime."
  );
  assert.equal(ctx.session.syllabusMessageId, null);
  const deletes = ctxCalls(calls, "api.deleteMessage");
  assert.ok(
    deletes.some(args => args[0] === 7 && args[1] === 5),
    "loading message is deleted"
  );
  assert.ok(
    deletes.some(args => args[0] === 7 && args[1] === 3),
    "callback message is deleted"
  );
});

test("expired sessions surface their own message", async () => {
  const boundary = createSyllabusErrorBoundary();
  const { ctx, calls } = syllabusCtx(5);

  const handled = (await runBoundary(
    boundary,
    new SessionNotFoundError(),
    ctx
  )) as HandledBotError;

  assert.ok(handled instanceof HandledBotError);
  const replies = ctxCalls(calls, "ctx.reply");
  assert.match(replies[0]?.[0] as string, /Session expired/);
});

test("unexpected failures fall back to a generic message", async () => {
  const boundary = createSyllabusErrorBoundary();
  const { ctx, calls } = syllabusCtx(5);

  const handled = (await runBoundary(
    boundary,
    new Error("null pointer somewhere"),
    ctx
  )) as HandledBotError;

  assert.ok(handled instanceof HandledBotError);
  assert.equal(handled.originalError.message, "null pointer somewhere");
  const replies = ctxCalls(calls, "ctx.reply");
  assert.match(replies[0]?.[0] as string, /something went wrong/);
  assert.equal(ctx.session.syllabusMessageId, null);
});

test("non-error throws are wrapped before rethrowing", async () => {
  const boundary = createSyllabusErrorBoundary();
  const { ctx, calls } = syllabusCtx(null);

  const handled = (await runBoundary(
    boundary,
    "weird string failure",
    ctx
  )) as HandledBotError;

  assert.ok(handled.originalError instanceof Error);
  assert.equal(handled.originalError.message, "weird string failure");
  assert.match(
    ctxCalls(calls, "ctx.reply")[0]?.[0] as string,
    /something went wrong/
  );
});

test("absent loading messages are skipped without failing", async () => {
  const boundary = createSyllabusErrorBoundary();
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ syllabusMessageId: null }),
  });

  const handled = (await runBoundary(
    boundary,
    new KTUAPIError("fetchSchemes", "down", "Try again later."),
    ctx
  )) as HandledBotError;

  assert.deepEqual(handled.cleanupActions, []);
  assert.deepEqual(
    ctxCalls(calls, "api.deleteMessage"),
    [],
    "no loading and no callback message exist, so nothing is deleted"
  );
  assert.equal(ctxCalls(calls, "ctx.reply")[0]?.[0], "Try again later.");
});

test("known KTU messages win over a supplied fallback", async () => {
  const boundary = createSyllabusErrorBoundary("fallback that must lose");
  const { ctx, calls } = syllabusCtx(5);

  await runBoundary(
    boundary,
    new KTUAPIError("fetchPrograms", "down", "KTU says try later."),
    ctx
  );

  assert.equal(ctxCalls(calls, "ctx.reply")[0]?.[0], "KTU says try later.");
});

test("a failing fetch surfaces its KTU message through the boundary", async () => {
  const boundary = createSyllabusErrorBoundary();
  const ktuError = new KTUAPIError(
    "fetchPrograms",
    "backend down",
    "KTU is busy right now."
  );
  const { ctx, calls } = createFakeCtx({ callbackData: "start" });

  const caught = await createSyllabusFlow({
    fetchPrograms: async () => {
      throw ktuError;
    },
    fetchSchemes: async () => [],
    fetchBranches: async () => [],
    fetchSyllabus: async () => [],
    queueDownload: async () => {},
  })
    .start(ctx)
    .catch((error: unknown) => error);
  assert.strictEqual(caught, ktuError);

  const handled = (await runBoundary(boundary, caught, ctx)) as HandledBotError;
  assert.ok(handled instanceof HandledBotError);
  assert.equal(
    ctxCalls(calls, "ctx.reply").at(-1)?.[0],
    "KTU is busy right now."
  );
  // The loading message from start() is cleaned up by the boundary.
  assert.deepEqual(handled.cleanupActions, [
    "deleted-loading-message-syllabusMessageId",
  ]);
});

test("callers can override the fallback and the tracked keys", async () => {
  const boundary = createComposerErrorBoundary(
    ["announcementsMessageId"],
    "custom fallback"
  );
  const { ctx, calls } = createFakeCtx({
    session: baseSession({ announcementsMessageId: 9 }),
    callbackMessageId: 3,
  });

  const handled = (await runBoundary(
    boundary,
    new Error("boom"),
    ctx
  )) as HandledBotError;

  assert.equal(ctxCalls(calls, "ctx.reply")[0]?.[0], "custom fallback");
  assert.equal(ctx.session.announcementsMessageId, null);
  assert.deepEqual(handled.cleanupActions, [
    "deleted-loading-message-announcementsMessageId",
  ]);
});
