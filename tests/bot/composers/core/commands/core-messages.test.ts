import assert from "node:assert/strict";
import test from "node:test";
import { Bot } from "grammy";
import type { MessageEntity } from "grammy/types";
import type { BotContext } from "../../../../../src/types/bot.types.js";
import { coreCommandsGroup } from "../../../../../src/bot/composers/core/commands/group.js";
import { BotConfig } from "../../../../../src/configs/bot.js";

async function renderCommand(command: string, firstName = "Tester") {
  const requests: Array<{ method: string; payload: Record<string, unknown> }> =
    [];
  const bot = new Bot<BotContext>("123:test", {
    botInfo: {
      id: 123,
      is_bot: true,
      first_name: "Test bot",
      username: BotConfig.BOT_USERNAME,
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: true,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
    },
    client: {
      fetch: async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        const method = new URL(url).pathname.split("/").at(-1)!;
        assert.ok(
          method === "sendMessage" || method === "sendPhoto",
          `Unexpected API call: ${method}`
        );
        assert.equal(typeof init?.body, "string");
        const payload: unknown = JSON.parse(init!.body as string);
        assert.ok(
          typeof payload === "object" &&
            payload !== null &&
            !Array.isArray(payload)
        );
        requests.push({ method, payload: payload as Record<string, unknown> });
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              message_id: 2,
              date: 0,
              chat: { id: 7, type: "private" },
            },
          }),
          {
            headers: { "content-type": "application/json" },
          }
        );
      },
    },
  });
  bot.use(coreCommandsGroup);
  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: 7, type: "private", first_name: firstName },
      from: { id: 11, is_bot: false, first_name: firstName },
      text: `/${command}`,
      entities: [
        { type: "bot_command", offset: 0, length: command.length + 1 },
      ],
    },
  });
  assert.equal(requests.length, 1);
  return requests[0]!;
}

function formattedSpans(
  payload: Record<string, unknown>,
  type: MessageEntity["type"]
) {
  const text = (payload["text"] ?? payload["caption"]) as string;
  const entities = (payload["entities"] ??
    payload["caption_entities"]) as MessageEntity[];
  assert.equal(typeof text, "string");
  assert.ok(Array.isArray(entities));
  assert.ok(text.length <= (payload["caption"] === undefined ? 4096 : 1024));
  for (const entity of entities) {
    assert.ok(
      entity.offset >= 0 &&
        entity.length > 0 &&
        entity.offset + entity.length <= text.length
    );
  }
  return entities
    .filter(entity => entity.type === type)
    .map(entity => text.slice(entity.offset, entity.offset + entity.length));
}

test("help keeps command sections formatted after joining and disables link previews", async () => {
  const { method, payload } = await renderCommand("help");
  assert.equal(method, "sendMessage");
  assert.deepEqual(formattedSpans(payload, "bold"), [
    "Find documents",
    "Announcement alerts",
    "More",
  ]);
  assert.equal(formattedSpans(payload, "blockquote").length, 1);
  assert.deepEqual(payload["link_preview_options"], { is_disabled: true });
  const text = payload["text"] as string;
  // Every section uses the same stacked layout: command, description, blank line.
  assert.match(
    text,
    /\/announcements\nBrowse KTU announcements\n\n\/calendars\nBrowse academic calendars\n\n\/timetables\nBrowse exam timetables\n\n\/syllabus\nDownload syllabuses/
  );
  assert.match(
    text,
    /\/announcements_subscribe\nGet new announcements in this chat\n\n\/announcements_unsubscribe\nStop announcement alerts/
  );
  assert.match(
    text,
    /\/start\nMeet the bot\n\n\/help\nSee everything I can do/
  );
  const commandRows = text.split("\n").filter(line => line.startsWith("/"));
  assert.equal(commandRows.length, 13);
  for (const row of commandRows)
    assert.doesNotMatch(row, /\p{Extended_Pictographic}/u);
  assert.doesNotMatch(text, /—/);
  assert.doesNotMatch(text, /\n\n\n/);
});

test("search preserves complete code examples and its inline search buttons", async () => {
  const { payload } = await renderCommand("search");
  const examples = formattedSpans(payload, "code");
  for (const query of ["ann: btech exam", "cal: semester", "tt: btech s3"]) {
    assert.ok(examples.includes(`@${BotConfig.BOT_USERNAME} ${query}`));
  }
  assert.ok(payload["reply_markup"]);
  assert.deepEqual(payload["link_preview_options"], { is_disabled: true });
});

test("start renders user names literally and sends a valid formatted photo caption", async () => {
  const { method, payload } = await renderCommand("start", "A😀 <&>");
  assert.equal(method, "sendPhoto");
  assert.match(
    payload["caption"] as string,
    /^👋 Hi A😀 <&>! Welcome to KTU Bot\./
  );
  assert.doesNotMatch(payload["caption"] as string, /—|\n\n\n/);
  assert.equal(payload["photo"], BotConfig.BOT_IMAGE_URL);
});
