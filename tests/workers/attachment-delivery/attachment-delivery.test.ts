import assert from "node:assert/strict";
import test from "node:test";
import type { Job, Queue } from "bullmq";
import { GrammyError, type Bot } from "grammy";
import type { BotContext } from "../../../src/types/bot.types.js";
import type { Attachment } from "../../../src/types/service.types.js";
import type { DownloadedAttachment } from "../../../src/utils/attachment-download.js";
import { TELEGRAM_MAX_FILE_SIZE_BYTES } from "../../../src/utils/attachment-download.js";
import {
  AttachmentDeliveryProcessor,
  type AttachmentDeliveryDeps,
} from "../../../src/workers/attachment-delivery/worker.js";
import type { AttachmentDeliveryJob } from "../../../src/workers/attachment-delivery/queue.js";

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
    cleanupFailures?: Record<string, Error>;
    grammyErrorHandler?: AttachmentDeliveryDeps["handleGrammyError"];
  } = {}
) {
  const calls: ApiCall[] = [];
  const downloads: DownloadCall[] = [];
  const cleaned: string[] = [];
  const links: Array<{ chatId: number; fileName: string }> = [];
  const grammyRecovery: Array<{ chatId: number; error: GrammyError }> = [];
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
  const deps: AttachmentDeliveryDeps = {
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
      const cleanupFailure = options.cleanupFailures?.[downloaded.tempFilePath];
      if (cleanupFailure) {
        throw cleanupFailure;
      }
    },
    sendOversizedAsLink: async (_bot, chatId, downloaded) => {
      links.push({ chatId, fileName: downloaded.fileName });
      return "https://files/large.pdf";
    },
    handleGrammyError: async (chatId, error, queue) => {
      grammyRecovery.push({ chatId, error });
      if (options.grammyErrorHandler) {
        await options.grammyErrorHandler(chatId, error, queue);
        return;
      }
      // Mimics the unrecognized/rate-limited recovery path.
      throw error;
    },
  };
  const processor = new AttachmentDeliveryProcessor(
    { api } as unknown as Bot<BotContext>,
    {} as unknown as Queue<AttachmentDeliveryJob>,
    deps
  );
  return {
    api,
    calls,
    downloads,
    cleaned,
    links,
    grammyRecovery,
    processor,
  };
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

test("cleanup attempts every downloaded file and preserves all failures", async () => {
  const firstFailure = new Error("cleanup a failed");
  const secondFailure = new Error("cleanup b failed");
  const { cleaned, processor } = createHarness({
    cleanupFailures: {
      "/tmp/enc-a.pdf.pdf": firstFailure,
      "/tmp/enc-b.pdf.pdf": secondFailure,
    },
  });

  const caught = await processor
    .process(deliveryJob([attachment("a.pdf"), attachment("b.pdf")]))
    .catch((error: unknown) => error);

  assert.ok(caught instanceof AggregateError);
  assert.deepEqual(cleaned, ["/tmp/enc-a.pdf.pdf", "/tmp/enc-b.pdf.pdf"]);
  assert.equal(caught.errors.length, 2);
  assert.strictEqual(caught.errors[0], firstFailure);
  assert.strictEqual(caught.errors[1], secondFailure);
  assert.strictEqual(caught.cause, firstFailure);
  assert.match(caught.message, /Temp file cleanup failed/);
});

test("a single cleanup failure propagates unchanged", async () => {
  const failure = new Error("cleanup a failed");
  const { processor } = createHarness({
    cleanupFailures: { "/tmp/enc-a.pdf.pdf": failure },
  });

  const caught = await processor
    .process(deliveryJob([attachment("a.pdf")]))
    .catch((error: unknown) => error);

  assert.strictEqual(caught, failure);
});

test("send and cleanup failures are both preserved", async () => {
  const sendFailure = new Error("telegram down");
  const cleanupFailure = new Error("cleanup a failed");
  const { api, calls, cleaned, processor } = createHarness({
    cleanupFailures: { "/tmp/enc-a.pdf.pdf": cleanupFailure },
  });
  api.sendDocument = async (...args: unknown[]) => {
    calls.push({ method: "sendDocument", args });
    throw sendFailure;
  };

  const caught = await processor
    .process(deliveryJob([attachment("a.pdf")], { statusMessageId: 9 }))
    .catch((error: unknown) => error);

  assert.ok(caught instanceof AggregateError);
  assert.equal(caught.errors.length, 2);
  assert.strictEqual(caught.errors[0], sendFailure);
  assert.strictEqual(caught.errors[1], cleanupFailure);
  assert.strictEqual(caught.cause, sendFailure);
  assert.match(caught.message, /delivery failed and temp file cleanup failed/);
  const edit = calls.find(call => call.method === "editMessageText");
  assert.deepEqual(edit?.args.slice(0, 2), [7, 9]);
  assert.match(edit?.args[2] as string, /Something went wrong/);
  assert.deepEqual(cleaned, ["/tmp/enc-a.pdf.pdf"]);
});

test("GrammyError with cleanup failure reaches Telegram recovery", async () => {
  const grammyFailure = new GrammyError(
    "blocked",
    {
      ok: false,
      error_code: 403,
      description: "Forbidden: bot was blocked by the user",
    },
    "sendDocument",
    {}
  );
  const cleanupFailure = new Error("cleanup a failed");
  const { api, grammyRecovery, processor } = createHarness({
    cleanupFailures: { "/tmp/enc-a.pdf.pdf": cleanupFailure },
  });
  api.sendDocument = async () => {
    throw grammyFailure;
  };

  const caught = await processor
    .process(deliveryJob([attachment("a.pdf")]))
    .catch((error: unknown) => error);

  assert.equal(grammyRecovery.length, 1);
  assert.equal(grammyRecovery[0]?.chatId, 7);
  assert.strictEqual(grammyRecovery[0]?.error, grammyFailure);
  // Recovery rethrows, so the original combined failure is preserved.
  assert.ok(caught instanceof AggregateError);
  assert.equal(caught.errors.length, 2);
  assert.strictEqual(caught.errors[0], grammyFailure);
  assert.strictEqual(caught.errors[1], cleanupFailure);
  assert.strictEqual(caught.cause, grammyFailure);
});

test("cleanup failures stay visible after Telegram recovery handles the error", async () => {
  const grammyFailure = new GrammyError(
    "blocked",
    {
      ok: false,
      error_code: 403,
      description: "Forbidden: bot was blocked by the user",
    },
    "sendDocument",
    {}
  );
  const firstCleanupFailure = new Error("cleanup a failed");
  const secondCleanupFailure = new Error("cleanup b failed");
  const { api, grammyRecovery, processor } = createHarness({
    cleanupFailures: {
      "/tmp/enc-a.pdf.pdf": firstCleanupFailure,
      "/tmp/enc-b.pdf.pdf": secondCleanupFailure,
    },
    grammyErrorHandler: async () => {
      // Simulates blocked/deactivated recovery completing successfully.
    },
  });
  api.sendDocument = async () => {
    throw grammyFailure;
  };

  const caught = await processor
    .process(deliveryJob([attachment("a.pdf"), attachment("b.pdf")]))
    .catch((error: unknown) => error);

  assert.equal(grammyRecovery.length, 1);
  assert.strictEqual(grammyRecovery[0]?.error, grammyFailure);
  assert.ok(caught instanceof AggregateError);
  assert.equal(caught.errors.length, 2);
  assert.strictEqual(caught.errors[0], firstCleanupFailure);
  assert.strictEqual(caught.errors[1], secondCleanupFailure);
  assert.match(
    caught.message,
    /cleanup failed after handling a Telegram error/
  );
});

test("a handled GrammyError without cleanup failures does not fail the job", async () => {
  const grammyFailure = new GrammyError(
    "blocked",
    {
      ok: false,
      error_code: 403,
      description: "Forbidden: bot was blocked by the user",
    },
    "sendDocument",
    {}
  );
  const { api, grammyRecovery, processor } = createHarness({
    grammyErrorHandler: async () => {
      // Simulates blocked/deactivated recovery completing successfully.
    },
  });
  api.sendDocument = async () => {
    throw grammyFailure;
  };

  await processor.process(deliveryJob([attachment("a.pdf")]));

  assert.equal(grammyRecovery.length, 1);
  assert.strictEqual(grammyRecovery[0]?.error, grammyFailure);
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
