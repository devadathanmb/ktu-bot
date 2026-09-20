import type { CallbackQueryContext } from "grammy";
import type { BotContext, SessionData } from "../../src/types/bot.types.js";

export interface CtxCall {
  method: string;
  args: unknown[];
}

// The fake satisfies both plain and callback-query contexts so flow
// functions (BotContext) and their select/page handlers
// (CallbackQueryContext<BotContext>) accept it directly.
export type FakeCtx = BotContext & CallbackQueryContext<BotContext>;

export function baseSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    announcementSubscriptionMessageId: null,
    selectedFilters: [],
    announcementsPage: null,
    announcementsAnnouncements: [],
    announcementsMessageId: null,
    timetablePage: null,
    timetableTimetables: [],
    timetableMessageId: null,
    calendarPage: null,
    calendarCalendars: [],
    calendarMessageId: null,
    syllabusProgramPage: null,
    syllabusSchemePage: null,
    syllabusBranchPage: null,
    syllabusSyllabusPage: null,
    syllabusPrograms: [],
    syllabusSchemes: [],
    syllabusBranches: [],
    syllabusEntries: [],
    syllabusSelectedProgramId: null,
    syllabusSelectedSchemeId: null,
    syllabusMessageId: null,
    ...overrides,
  };
}

export interface FakeCtxOptions {
  session?: SessionData;
  chatId?: number;
  msgId?: number;
  callbackData?: string;
  callbackMessageId?: number;
  replyMessageId?: number;
  apiDeleteError?: Error;
}

export function createFakeCtx(options: FakeCtxOptions = {}): {
  ctx: FakeCtx;
  calls: CtxCall[];
} {
  const calls: CtxCall[] = [];
  const callbackMessageId = options.callbackMessageId ?? 3;
  let nextReplyId = options.replyMessageId ?? 40;
  const ctx = {
    session: options.session ?? baseSession(),
    chat: { id: options.chatId ?? 7 },
    msgId: options.msgId,
    from: { id: 11, username: "tester" },
    callbackQuery:
      options.callbackData === undefined
        ? undefined
        : {
            data: options.callbackData,
            message: { message_id: callbackMessageId },
          },
    match: [options.callbackData ?? ""] as unknown as RegExpMatchArray,
    update:
      options.callbackData === undefined
        ? {}
        : {
            callback_query: {
              data: options.callbackData,
              message: { message_id: callbackMessageId },
            },
          },
    api: {
      editMessageText: async (...args: unknown[]) => {
        calls.push({ method: "api.editMessageText", args });
        return true;
      },
      deleteMessage: async (...args: unknown[]) => {
        calls.push({ method: "api.deleteMessage", args });
        if (options.apiDeleteError) throw options.apiDeleteError;
        return true;
      },
    },
    editMessageText: async (...args: unknown[]) => {
      calls.push({ method: "ctx.editMessageText", args });
      return true;
    },
    reply: async (...args: unknown[]) => {
      calls.push({ method: "ctx.reply", args });
      const messageId = nextReplyId;
      nextReplyId += 1;
      return { message_id: messageId };
    },
    answerCallbackQuery: async (...args: unknown[]) => {
      calls.push({ method: "ctx.answerCallbackQuery", args });
      return true;
    },
  } as unknown as FakeCtx;
  return { ctx, calls };
}

export function ctxCalls(calls: CtxCall[], method: string): unknown[][] {
  return calls.filter(call => call.method === method).map(call => call.args);
}
