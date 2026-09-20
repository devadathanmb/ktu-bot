import assert from "node:assert/strict";
import test from "node:test";
import type { Filter } from "grammy";
import type { ChatMember } from "grammy/types";
import {
  handleChatMemberUpdate,
  type ChatMembershipPersistence,
} from "../../../src/bot/handlers/chat-member.js";
import type { BotContext } from "../../../src/types/bot.types.js";
import { ctxCalls, type CtxCall } from "../fakes.js";

function createChatMemberContext(
  oldStatus: ChatMember["status"],
  newStatus: ChatMember["status"],
  options: { replyError?: Error } = {}
): {
  ctx: Filter<BotContext, "my_chat_member">;
  calls: CtxCall[];
} {
  const calls: CtxCall[] = [];
  const ctx = {
    chat: { id: 7 },
    chatId: 7,
    myChatMember: {
      old_chat_member: { status: oldStatus },
      new_chat_member: { status: newStatus },
    },
    reply: async (...args: unknown[]) => {
      calls.push({ method: "ctx.reply", args });
      if (options.replyError) throw options.replyError;
      return { message_id: 1 };
    },
  } as unknown as Filter<BotContext, "my_chat_member">;
  return { ctx, calls };
}

function createPersistence(): {
  persistence: ChatMembershipPersistence;
  calls: string[];
} {
  const calls: string[] = [];
  const persistence: ChatMembershipPersistence = {
    async markChatActive(chatId) {
      calls.push(`active:${chatId}`);
    },
    async markChatKicked(chatId) {
      calls.push(`kicked:${chatId}`);
    },
  };
  return { persistence, calls };
}

test("unblocking welcomes the chat after committing the active state", async () => {
  const { ctx, calls } = createChatMemberContext("kicked", "member");
  const { persistence, calls: persistenceCalls } = createPersistence();

  let repliesAtCommit = -1;
  persistence.markChatActive = async chatId => {
    persistenceCalls.push(`active:${chatId}`);
    repliesAtCommit = ctxCalls(calls, "ctx.reply").length;
  };

  await handleChatMemberUpdate(ctx, persistence);

  assert.equal(repliesAtCommit, 0);
  assert.deepEqual(persistenceCalls, ["active:7"]);
  const replies = ctxCalls(calls, "ctx.reply");
  assert.deepEqual(replies.length, 1);
  assert.match(replies[0]?.[0] as string, /Welcome back!/);
  assert.match(replies[0]?.[0] as string, /\/announcements_subscribe/);
});

test("a failed unblock write sends no welcome", async () => {
  const { ctx, calls } = createChatMemberContext("kicked", "member");
  const { persistence } = createPersistence();
  persistence.markChatActive = async () => {
    throw new Error("database unavailable");
  };

  await assert.rejects(
    handleChatMemberUpdate(ctx, persistence),
    /database unavailable/
  );

  assert.equal(ctxCalls(calls, "ctx.reply").length, 0);
});

test("a welcome failure after the committed unblock propagates without an inverse reply", async () => {
  const { ctx, calls } = createChatMemberContext("kicked", "member", {
    replyError: new Error("telegram unavailable"),
  });
  const { persistence, calls: persistenceCalls } = createPersistence();

  await assert.rejects(
    handleChatMemberUpdate(ctx, persistence),
    /telegram unavailable/
  );

  assert.deepEqual(persistenceCalls, ["active:7"]);
  // Only the failed welcome was attempted; nothing suggests a rollback.
  assert.equal(ctxCalls(calls, "ctx.reply").length, 1);
});

test("kicking commits the state without replying", async () => {
  const { ctx, calls } = createChatMemberContext("member", "kicked");
  const { persistence, calls: persistenceCalls } = createPersistence();

  await handleChatMemberUpdate(ctx, persistence);

  assert.deepEqual(persistenceCalls, ["kicked:7"]);
  assert.equal(ctxCalls(calls, "ctx.reply").length, 0);
});

test("a failed kick write propagates without replying", async () => {
  const { ctx, calls } = createChatMemberContext("member", "kicked");
  const { persistence } = createPersistence();
  persistence.markChatKicked = async () => {
    throw new Error("database unavailable");
  };

  await assert.rejects(
    handleChatMemberUpdate(ctx, persistence),
    /database unavailable/
  );

  assert.equal(ctxCalls(calls, "ctx.reply").length, 0);
});

test("unrelated status changes touch neither persistence nor Telegram", async () => {
  const { ctx, calls } = createChatMemberContext("member", "member");
  const { persistence, calls: persistenceCalls } = createPersistence();

  await handleChatMemberUpdate(ctx, persistence);

  assert.deepEqual(persistenceCalls, []);
  assert.equal(ctxCalls(calls, "ctx.reply").length, 0);
});
