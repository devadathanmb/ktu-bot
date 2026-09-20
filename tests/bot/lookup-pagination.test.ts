import assert from "node:assert/strict";
import test from "node:test";
import { FormattedString } from "@grammyjs/parse-mode";
import { InlineKeyboard } from "grammy";
import type { BotContext } from "../../src/types/bot.types.js";
import {
  fetchAndRenderApiPage,
  findItemById,
  handleApiNextPage,
  handleApiPreviousPage,
  parseSelectCallback,
  startApiPaginatedLookup,
} from "../../src/bot/composers/lookups/utils.js";
import { SessionNotFoundError } from "../../src/errors/bot-errors.js";
import { createFakeCtx, ctxCalls } from "./fakes.js";

interface Item {
  id: number;
  subject: string;
}

function item(id: number): Item {
  return { id, subject: `Item ${id}` };
}

function stubConfig(options: {
  page?: number | null;
  items?: Item[];
  fetch?: (page: number) => Promise<Item[]>;
}) {
  const fetchedPages: number[] = [];
  let page: number | null = options.page ?? 0;
  let stored = options.items ?? [];
  const fetch = options.fetch ?? (async () => []);
  return {
    fetchedPages,
    get stored() {
      return stored;
    },
    get currentPage() {
      return page;
    },
    config: {
      messageIdSessionKey: "timetableMessageId" as const,
      getPage: (_ctx: BotContext) => page,
      setPage: (_ctx: BotContext, next: number | null) => {
        page = next;
      },
      getItems: (_ctx: BotContext) => stored,
      setItems: (_ctx: BotContext, next: Item[]) => {
        stored = next;
      },
      fetchPage: async (next: number) => {
        fetchedPages.push(next);
        return fetch(next);
      },
      buildKeyboard: (_items: Item[], _page: number) =>
        new InlineKeyboard().text("x", "x_info"),
      buildText: (list: Item[]) =>
        new FormattedString(list.map(entry => entry.subject).join(",")),
      loadingMessage: new FormattedString("loading..."),
    },
  };
}

test("fetch-and-render stores the fetched page and shows it", async () => {
  const stub = stubConfig({ page: 2, fetch: async () => [item(1), item(2)] });
  const { ctx, calls } = createFakeCtx({ callbackData: "timetable_next_page" });

  await fetchAndRenderApiPage(ctx, stub.config);

  assert.deepEqual(stub.fetchedPages, [2]);
  assert.equal(stub.currentPage, 2);
  assert.deepEqual(stub.stored, [item(1), item(2)]);
  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.deepEqual(edits[0]?.[0], "loading...");
  assert.deepEqual(edits.at(-1)?.[0], "Item 1,Item 2");
  assert.equal(ctx.session.timetableMessageId, 3);
});

test("start edits the loading message in place", async () => {
  const stub = stubConfig({ fetch: async () => [item(1)] });
  const { ctx, calls } = createFakeCtx();

  await startApiPaginatedLookup(ctx, stub.config, 40);

  assert.deepEqual(stub.stored, [item(1)]);
  assert.equal(stub.currentPage, 0);
  const apiEdits = ctxCalls(calls, "api.editMessageText");
  assert.deepEqual(apiEdits[0]?.slice(0, 3), [7, 40, "Item 1"]);
});

test("previous page stops on the first page", async () => {
  const stub = stubConfig({ page: 0 });
  const { ctx, calls } = createFakeCtx({ callbackData: "timetable_prev_page" });

  await handleApiPreviousPage(ctx, stub.config);

  assert.deepEqual(stub.fetchedPages, []);
  assert.deepEqual(ctxCalls(calls, "ctx.answerCallbackQuery"), [
    ["You are already on the first page."],
  ]);
});

test("previous page off the first page refetches and renders", async () => {
  const stub = stubConfig({ page: 2, fetch: async () => [item(9)] });
  const { ctx, calls } = createFakeCtx({ callbackData: "timetable_prev_page" });

  await handleApiPreviousPage(ctx, stub.config);

  assert.deepEqual(stub.fetchedPages, [1]);
  assert.equal(stub.currentPage, 1);
  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.deepEqual(edits.at(-1)?.[0], "Item 9");
});

test("next page stops when the current page is short", async () => {
  const stub = stubConfig({
    page: 0,
    items: [item(1), item(2), item(3)],
    fetch: async () => {
      throw new Error("must not fetch");
    },
  });
  const { ctx, calls } = createFakeCtx({ callbackData: "timetable_next_page" });

  await handleApiNextPage(ctx, stub.config);

  assert.deepEqual(stub.fetchedPages, []);
  assert.deepEqual(ctxCalls(calls, "ctx.answerCallbackQuery"), [
    ["You are already on the last page."],
  ]);
});

test("next page stops when the following page is empty", async () => {
  const stub = stubConfig({
    page: 0,
    items: Array.from({ length: 10 }, (_, index) => item(index)),
    fetch: async () => [],
  });
  const { ctx, calls } = createFakeCtx({ callbackData: "timetable_next_page" });

  await handleApiNextPage(ctx, stub.config);

  assert.deepEqual(stub.fetchedPages, [1]);
  assert.equal(stub.currentPage, 0);
  assert.deepEqual(ctxCalls(calls, "ctx.answerCallbackQuery"), [
    ["You are already on the last page."],
  ]);
});

test("next page renders and stores a non-empty following page", async () => {
  const stub = stubConfig({
    page: 0,
    items: Array.from({ length: 10 }, (_, index) => item(index)),
    fetch: async () => [item(10)],
  });
  const { ctx, calls } = createFakeCtx({ callbackData: "timetable_next_page" });

  await handleApiNextPage(ctx, stub.config);

  assert.equal(stub.currentPage, 1);
  assert.deepEqual(stub.stored, [item(10)]);
  const edits = ctxCalls(calls, "ctx.editMessageText");
  assert.deepEqual(edits.at(-1)?.[0], "Item 10");
});

test("select callbacks keep the prefix-select-id contract", () => {
  assert.deepEqual(parseSelectCallback("timetable_select_91", "timetable"), {
    isValid: true,
    id: 91,
  });
  assert.equal(
    parseSelectCallback("calendar_select_91", "timetable").isValid,
    false
  );
  assert.equal(
    parseSelectCallback("timetable_select_abc", "timetable").isValid,
    false
  );
  assert.equal(
    parseSelectCallback("timetable_select", "timetable").isValid,
    false
  );
});

test("missing session items throw instead of rendering blindly", () => {
  assert.throws(() => findItemById([], 91), SessionNotFoundError);
});
