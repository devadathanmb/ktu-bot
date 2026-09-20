import assert from "node:assert/strict";
import test, { after } from "node:test";
import { FormattedString } from "@grammyjs/parse-mode";
import type { Job, Queue } from "bullmq";
import { GrammyError, type Bot } from "grammy";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../../../src/db/schema/index.js";
import type { BotContext } from "../../../src/types/bot.types.js";
import { broadcastsQueue } from "../../../src/workers/broadcasts/queue.js";
import { BroadcastProcessor } from "../../../src/workers/broadcasts/worker.js";
import type {
  BroadcastJob,
  ProcessedAttachment,
} from "../../../src/workers/shared/types.js";

interface ApiCall {
  method: string;
  args: unknown[];
}

// The imported queue module constructs the real queue; it is never used
// here, only its retry defaults are asserted, so close it after.
after(async () => {
  await broadcastsQueue.close();
});

function createHarness(subscribed: boolean) {
  const calls: ApiCall[] = [];
  const api = {
    sendMessage: async (...args: unknown[]) => {
      calls.push({ method: "sendMessage", args });
      return { message_id: 10 };
    },
    sendMediaGroup: async (...args: unknown[]) => {
      calls.push({ method: "sendMediaGroup", args });
      return [{ message_id: 11 }];
    },
    sendDocument: async (...args: unknown[]) => {
      calls.push({ method: "sendDocument", args });
      return { message_id: 12 };
    },
  };
  const db = {
    $count: async () => (subscribed ? 1 : 0),
  } as unknown as NodePgDatabase<typeof schema>;
  const processor = new BroadcastProcessor(
    db,
    { api } as unknown as Bot<BotContext>,
    {} as unknown as Queue<BroadcastJob>
  );
  return { api, calls, processor };
}

function broadcastJob(data: BroadcastJob): Job<BroadcastJob> {
  return { id: "job-1", data } as unknown as Job<BroadcastJob>;
}

function textJob(attachments: ProcessedAttachment[] = []): Job<BroadcastJob> {
  return broadcastJob({
    chatId: 7,
    formattedText: new FormattedString("Hello", [
      { type: "bold", offset: 0, length: 5 },
    ]),
    attachments,
  });
}

function fileAttachment(name: string): ProcessedAttachment {
  return { fileName: name, fileId: `file-${name}` };
}

test("skips delivery when the chat unsubscribed while queued", async () => {
  const { calls, processor } = createHarness(false);

  await processor.process(textJob([fileAttachment("a.pdf")]));

  assert.deepEqual(calls, []);
});

test("sends text-only broadcasts as a plain message", async () => {
  const { calls, processor } = createHarness(true);

  await processor.process(textJob());

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    method: "sendMessage",
    args: [
      7,
      "Hello",
      {
        entities: [{ type: "bold", offset: 0, length: 5 }],
        link_preview_options: { is_disabled: true },
      },
    ],
  });
});

test("sends a single attachment as a document with the caption", async () => {
  const { calls, processor } = createHarness(true);

  await processor.process(textJob([fileAttachment("a.pdf")]));

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call?.method, "sendDocument");
  assert.equal(call?.args[0], 7);
  assert.equal(call?.args[1], "file-a.pdf");
  assert.deepEqual(call?.args[2], {
    caption: "Hello",
    caption_entities: [{ type: "bold", offset: 0, length: 5 }],
  });
});

test("sends a media group with the caption only on the first document", async () => {
  const { calls, processor } = createHarness(true);

  await processor.process(
    textJob([fileAttachment("a.pdf"), fileAttachment("b.pdf")])
  );

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call?.method, "sendMediaGroup");
  assert.equal(call?.args[0], 7);
  const media = call?.args[1] as Array<{
    media: string;
    caption?: string;
  }>;
  assert.deepEqual(
    media.map(document => document.media),
    ["file-a.pdf", "file-b.pdf"]
  );
  assert.equal(media[0]?.caption, "Hello");
  assert.equal(media[1]?.caption, undefined);
});

test("splits past ten attachments and threads later batches as replies", async () => {
  const { calls, processor } = createHarness(true);
  const attachments = Array.from({ length: 11 }, (_, index) =>
    fileAttachment(`${index}.pdf`)
  );

  await processor.process(textJob(attachments));

  assert.deepEqual(
    calls.map(call => call.method),
    ["sendMediaGroup", "sendDocument"]
  );
  const first = calls[0]?.args[1] as unknown[];
  assert.equal(first.length, 10);
  // The lone second batch goes out as a document replying to the first
  // batch message, without repeating the caption.
  assert.deepEqual(calls[1]?.args[2], {
    reply_parameters: { message_id: 11, allow_sending_without_reply: true },
  });
});

test("uses the file URL when no file ID is present", async () => {
  const { calls, processor } = createHarness(true);

  await processor.process(
    textJob([{ fileName: "a.pdf", fileUrl: "https://files/a.pdf" }])
  );

  assert.equal(calls[0]?.method, "sendDocument");
  assert.equal(calls[0]?.args[1], "https://files/a.pdf");
});

test("rethrows non-Grammy failures", async () => {
  const { api, processor } = createHarness(true);
  api.sendMessage = async () => {
    throw new Error("network down");
  };

  await assert.rejects(processor.process(textJob()), /network down/);
});

test("rethrows unrecognized Grammy errors after handling", async () => {
  const { api, processor } = createHarness(true);
  const failure = new GrammyError(
    "send failed",
    {
      ok: false,
      error_code: 400,
      description: "Bad Request: something unexpected",
    },
    "sendMessage",
    {}
  );
  api.sendMessage = async () => {
    throw failure;
  };

  const caught = await processor
    .process(textJob())
    .catch((error: unknown) => error);
  assert.strictEqual(caught, failure);
});

test("broadcasts queue retries past a sustained flood", () => {
  assert.equal(broadcastsQueue.opts.defaultJobOptions?.attempts, 8);
});
