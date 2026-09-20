import assert from "node:assert/strict";
import test from "node:test";
import type { Job, Queue } from "bullmq";
import { GrammyError, type Bot } from "grammy";
import type { BotContext } from "../../src/types/bot.types.js";
import type { Attachment } from "../../src/types/service.types.js";
import type { DownloadedAttachment } from "../../src/utils/attachment-download.js";
import { TELEGRAM_MAX_FILE_SIZE_BYTES } from "../../src/utils/attachment-download.js";
import { AttachmentDeliveryProcessor } from "../../src/workers/attachment-delivery/worker.js";
import type { AttachmentDeliveryJob } from "../../src/workers/attachment-delivery/queue.js";

interface ApiCall {
  method: string;
  args: unknown[];
}

interface DownloadCall {
  encryptId: string;
  fileName: string;
  source: string;
}

function createHarness(
  options: {
    sizes?: Record<string, number>;
    failOnDownload?: string;
  } = {}
) {
  const calls: ApiCall[] = [];
  const downloads: DownloadCall[] = [];
  const cleaned: string[] = [];
  const links: Array<{ chatId: number; fileName: string }> = [];
  const api = {
    sendDocument: async (...args: unknown[]) => {
      calls.push({ method: "sendDocument", args });
      return { message_id: 20 };
    },
    deleteMessage: async (...args: unknown[]) => {
      calls.push({ method: "deleteMessage", args });
      return true;
    },
    editMessageText: async (...args: unknown[]) => {
      calls.push({ method: "editMessageText", args });
      return true;
    },
    sendMessage: async (...args: unknown[]) => {
      calls.push({ method: "sendMessage", args });
      return { message_id: 21 };
    },
  };
  const processor = new AttachmentDeliveryProcessor(
    { api } as unknown as Bot<BotContext>,
    {} as unknown as Queue<AttachmentDeliveryJob>,
    {
      downloadAttachment: async (encryptId, fileName, source = "default") => {
        downloads.push({ encryptId, fileName, source });
        if (options.failOnDownload === encryptId) {
          throw new Error("ktu download failed");
        }
        const downloaded: DownloadedAttachment = {
          tempFilePath: `/tmp/${encryptId}.pdf`,
          fileName,
          fileSizeBytes: options.sizes?.[encryptId] ?? 1024,
        };
        return downloaded;
      },
      cleanupAttachment: async downloaded => {
        cleaned.push(downloaded.tempFilePath);
      },
      sendOversizedAsLink: async (_bot, chatId, downloaded) => {
        links.push({ chatId, fileName: downloaded.fileName });
        return "https://files/large.pdf";
      },
    }
  );
  return { api, calls, downloads, cleaned, links, processor };
}

function deliveryJob(
  attachments: Attachment[],
  overrides: Partial<AttachmentDeliveryJob> = {}
): Job<AttachmentDeliveryJob> {
  return {
    id: "job-1",
    data: {
      chatId: 7,
      attachments,
      context: "syllabus",
      ...overrides,
    },
  } as unknown as Job<AttachmentDeliveryJob>;
}

function attachment(name: string): Attachment {
  return { name, encryptId: `enc-${name}` };
}

test("downloads every attachment before sending any", async () => {
  const { calls, cleaned, processor } = createHarness({
    failOnDownload: "enc-b.pdf",
  });

  await assert.rejects(
    processor.process(
      deliveryJob([attachment("a.pdf"), attachment("b.pdf")], {
        statusMessageId: 9,
      })
    ),
    /ktu download failed/
  );

  assert.deepEqual(
    calls.map(call => call.method),
    ["editMessageText"]
  );
  // The first download is still cleaned up; nothing was sent.
  assert.deepEqual(cleaned, ["/tmp/enc-a.pdf.pdf"]);
});

test("captions only the first document and threads replies", async () => {
  const { calls, cleaned, processor } = createHarness();

  await processor.process(
    deliveryJob([attachment("a.pdf"), attachment("b.pdf")], {
      replyToMessageId: 5,
    })
  );

  const sends = calls.filter(call => call.method === "sendDocument");
  assert.equal(sends.length, 2);
  const firstOptions = sends[0]?.args[2] as Record<string, unknown>;
  assert.match(firstOptions["caption"] as string, /Attachments:/);
  assert.match(firstOptions["caption"] as string, /a\.pdf/);
  assert.match(firstOptions["caption"] as string, /b\.pdf/);
  assert.deepEqual(firstOptions["reply_parameters"], {
    message_id: 5,
    allow_sending_without_reply: true,
  });
  const secondOptions = sends[1]?.args[2] as Record<string, unknown>;
  assert.equal("caption" in secondOptions, false);
  assert.deepEqual(cleaned, ["/tmp/enc-a.pdf.pdf", "/tmp/enc-b.pdf.pdf"]);
});

test("deletes the status message and offers to view another", async () => {
  const { calls, processor } = createHarness();

  await processor.process(
    deliveryJob([attachment("a.pdf")], {
      statusMessageId: 9,
      sendViewAnotherMessage: true,
    })
  );

  assert.deepEqual(
    calls.map(call => call.method),
    ["sendDocument", "deleteMessage", "sendMessage"]
  );
  assert.deepEqual(calls[1]?.args, [7, 9]);
  assert.match(calls[2]?.args[1] as string, /View another syllabus\?/);
});

test("routes oversized files to link sending", async () => {
  const { calls, links, cleaned, processor } = createHarness({
    sizes: { "enc-big.pdf": TELEGRAM_MAX_FILE_SIZE_BYTES + 1 },
  });

  await processor.process(deliveryJob([attachment("big.pdf")]));

  assert.deepEqual(links, [{ chatId: 7, fileName: "big.pdf" }]);
  assert.ok(calls.every(call => call.method !== "sendDocument"));
  assert.deepEqual(cleaned, ["/tmp/enc-big.pdf.pdf"]);
});

test("an already-removed status message does not fail delivery", async () => {
  const { api, calls, processor } = createHarness();
  api.deleteMessage = async (...args: unknown[]) => {
    calls.push({ method: "deleteMessage", args });
    throw new GrammyError(
      "not found",
      {
        ok: false,
        error_code: 400,
        description: "Bad Request: message to delete not found",
      },
      "deleteMessage",
      {}
    );
  };

  await processor.process(
    deliveryJob([attachment("a.pdf")], { statusMessageId: 9 })
  );

  assert.ok(calls.some(call => call.method === "sendDocument"));
});

test("send failures update the status message and propagate", async () => {
  const { api, calls, cleaned, processor } = createHarness();
  api.sendDocument = async (...args: unknown[]) => {
    calls.push({ method: "sendDocument", args });
    throw new Error("telegram down");
  };

  await assert.rejects(
    processor.process(
      deliveryJob([attachment("a.pdf")], { statusMessageId: 9 })
    ),
    /telegram down/
  );

  const edit = calls.find(call => call.method === "editMessageText");
  assert.deepEqual(edit?.args.slice(0, 2), [7, 9]);
  assert.match(edit?.args[2] as string, /Something went wrong/);
  assert.deepEqual(cleaned, ["/tmp/enc-a.pdf.pdf"]);
});

test("unrecognized Grammy errors propagate", async () => {
  const { api, processor } = createHarness();
  const failure = new GrammyError(
    "send failed",
    {
      ok: false,
      error_code: 400,
      description: "Bad Request: something unexpected",
    },
    "sendDocument",
    {}
  );
  api.sendDocument = async () => {
    throw failure;
  };

  const caught = await processor
    .process(deliveryJob([attachment("a.pdf")]))
    .catch((error: unknown) => error);
  assert.strictEqual(caught, failure);
});
