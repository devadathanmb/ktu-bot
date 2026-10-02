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
import { combineFailures } from "../../../src/errors/combine-failures.js";

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
    splitAttachment?: AttachmentDeliveryDeps["splitAttachment"];
  } = {}
) {
  const calls: ApiCall[] = [];
  const downloads: DownloadCall[] = [];
  const cleaned: string[] = [];
  const links: Array<{ chatId: number; fileName: string }> = [];
  const grammyRecovery: Array<{ chatId: number; error: GrammyError }> = [];
  const api = {
    sendMediaGroup: async (...args: unknown[]) => {
      calls.push({ method: "sendMediaGroup", args });
      throw new GrammyError(
        "Request Entity Too Large",
        { ok: false, error_code: 413, description: "Request Entity Too Large" },
        "sendMediaGroup",
        {}
      );
    },
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
    splitAttachment: options.splitAttachment ?? (async () => []),
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
      requestedByUserId: 11,
      attachments,
      statusMessageId: 9,
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

function splitParts(): DownloadedAttachment[] {
  return [1, 2, 3].map(part => ({
    tempFilePath: `/tmp/part-${part}.pdf`,
    fileName: `big (part ${part} of 3).pdf`,
    fileSizeBytes: 30 * 1024 * 1024,
  }));
}

test("prepares and sends numbered PDF parts in order, then cleans original and parts", async () => {
  const parts = splitParts();
  const splitCalls: string[] = [];
  const { calls, links, cleaned, processor } = createHarness({
    sizes: { "enc-big.pdf": 94 * 1024 * 1024 },
    splitAttachment: async original => {
      splitCalls.push(original.fileName);
      assert.deepEqual(
        calls.map(call => call.method),
        ["editMessageText"]
      );
      assert.equal(
        calls[0]?.args[2],
        "⏳ This PDF is too large to send as one file (94 MiB).\n\nI’ll split it into smaller parts and send them here. Please wait…"
      );
      return parts;
    },
  });
  await processor.process(
    deliveryJob([attachment("big.pdf"), attachment("small.pdf")], {
      replyToMessageId: 5,
    })
  );
  assert.deepEqual(splitCalls, ["big.pdf"]);
  assert.deepEqual(links, []);
  const sends = calls.filter(
    call => call.method === "sendDocument" || call.method === "sendMediaGroup"
  );
  assert.deepEqual(
    sends.map(call => call.method),
    ["sendDocument", "sendDocument", "sendDocument", "sendDocument"]
  );
  assert.deepEqual(
    sends
      .slice(0, 3)
      .map(send => (send.args[1] as { filename: string }).filename),
    parts.map(part => part.fileName)
  );
  for (const [index, send] of sends.entries()) {
    const options = send.args[2] as Record<string, unknown>;
    if (index < 3)
      assert.equal(options["caption"], `📄 big.pdf\n\nPart ${index + 1} of 3`);
    else assert.equal("caption" in options, false);
    assert.deepEqual(options["reply_parameters"], {
      message_id: 5,
      allow_sending_without_reply: true,
    });
  }
  assert.deepEqual(cleaned, [
    "/tmp/enc-big.pdf.pdf",
    ...parts.map(part => part.tempFilePath),
    "/tmp/enc-small.pdf.pdf",
  ]);
});

test("split failure falls back to the original file link", async () => {
  const { calls, links, cleaned, processor } = createHarness({
    sizes: { "enc-big.pdf": 94 * 1024 * 1024 },
    splitAttachment: async () => {
      throw new Error("qpdf timed out");
    },
  });
  await processor.process(deliveryJob([attachment("big.pdf")]));
  assert.deepEqual(links, [{ chatId: 7, fileName: "big.pdf" }]);
  assert.ok(
    calls.every(
      call => call.method !== "sendDocument" && call.method !== "sendMediaGroup"
    )
  );
  assert.deepEqual(cleaned, ["/tmp/enc-big.pdf.pdf"]);
});

test("large part sets upload individually with context on each part", async () => {
  for (const count of [2, 3, 10, 11, 12, 19, 20]) {
    const parts = Array.from({ length: count }, (_, index) => ({
      tempFilePath: `/tmp/part-${index + 1}.pdf`,
      fileName: `big (part ${index + 1} of ${count}).pdf`,
      fileSizeBytes: 30 * 1024 * 1024,
    }));
    const { calls, processor, cleaned } = createHarness({
      sizes: { "enc-big.pdf": 94 * 1024 * 1024 },
      splitAttachment: async () => parts,
    });
    await processor.process(deliveryJob([attachment("big.pdf")]));
    const sends = calls.filter(call => call.method === "sendDocument");
    assert.equal(sends.length, count);
    assert.deepEqual(
      sends.map(send => (send.args[1] as { filename: string }).filename),
      parts.map(part => part.fileName)
    );
    for (const [index, send] of sends.entries()) {
      assert.equal(
        (send.args[2] as { caption: string }).caption,
        `📄 big.pdf\n\nPart ${index + 1} of ${count}`
      );
    }
    assert.equal(
      calls.some(call => call.method === "sendMediaGroup"),
      false
    );
    assert.equal(cleaned.length, count + 1);
  }
});

test("unavailable progress message does not stop splitting or delivery", async () => {
  const { api, calls, cleaned, processor } = createHarness({
    sizes: { "enc-big.pdf": 94 * 1024 * 1024 },
    splitAttachment: async () => splitParts(),
  });
  api.editMessageText = async () => {
    throw new Error("Message unavailable");
  };
  await processor.process(deliveryJob([attachment("big.pdf")]));
  assert.equal(calls.filter(call => call.method === "sendDocument").length, 3);
  assert.equal(cleaned.length, 4);
});

test("oversized non-PDF fallback does not announce PDF splitting", async () => {
  const { calls, links, processor } = createHarness({
    sizes: { "enc-big.zip": 94 * 1024 * 1024 },
  });
  await processor.process(deliveryJob([attachment("big.zip")]));
  assert.equal(
    calls.some(call => call.method === "editMessageText"),
    false
  );
  assert.deepEqual(links, [{ chatId: 7, fileName: "big.zip" }]);
});

test("split cleanup errors are not hidden by the link fallback", async () => {
  const failure = combineFailures(
    "split and cleanup failed",
    new Error("qpdf failed"),
    [new Error("cleanup failed")]
  );
  const { links, cleaned, processor } = createHarness({
    sizes: { "enc-big.pdf": 94 * 1024 * 1024 },
    splitAttachment: async () => {
      throw failure;
    },
  });
  await assert.rejects(
    processor.process(deliveryJob([attachment("big.pdf")])),
    error => error === failure
  );
  assert.deepEqual(links, []);
  assert.deepEqual(cleaned, ["/tmp/enc-big.pdf.pdf"]);
});

test("a later download failure sends no prepared parts and cleans them all", async () => {
  const parts = splitParts();
  const { calls, cleaned, processor } = createHarness({
    sizes: { "enc-big.pdf": 94 * 1024 * 1024 },
    failOnDownload: "enc-small.pdf",
    splitAttachment: async () => parts,
  });
  await assert.rejects(
    processor.process(
      deliveryJob([attachment("big.pdf"), attachment("small.pdf")])
    ),
    /ktu download failed/
  );
  assert.ok(
    calls.every(
      call => call.method !== "sendDocument" && call.method !== "sendMediaGroup"
    )
  );
  assert.deepEqual(cleaned, [
    "/tmp/enc-big.pdf.pdf",
    ...parts.map(part => part.tempFilePath),
  ]);
});

test("failed part delivery cleans every part without switching to a duplicate link delivery", async () => {
  const parts = splitParts();
  const { api, calls, links, cleaned, processor } = createHarness({
    sizes: { "enc-big.pdf": 94 * 1024 * 1024 },
    splitAttachment: async () => parts,
  });
  let sends = 0;
  api.sendDocument = async (...args: unknown[]) => {
    calls.push({ method: "sendDocument", args });
    sends++;
    throw new Error("Telegram unavailable");
  };
  await assert.rejects(
    processor.process(deliveryJob([attachment("big.pdf")])),
    /Telegram unavailable/
  );
  assert.equal(sends, 1);
  assert.deepEqual(links, []);
  assert.deepEqual(cleaned, [
    "/tmp/enc-big.pdf.pdf",
    ...parts.map(part => part.tempFilePath),
  ]);
});

test("a later part failure stops delivery and cleans every prepared part", async () => {
  const parts = Array.from({ length: 20 }, (_, index) => ({
    tempFilePath: `/tmp/part-${index + 1}.pdf`,
    fileName: `big (part ${index + 1} of 20).pdf`,
    fileSizeBytes: 30 * 1024 * 1024,
  }));
  const { api, calls, links, cleaned, processor } = createHarness({
    sizes: { "enc-big.pdf": 94 * 1024 * 1024 },
    splitAttachment: async () => parts,
  });
  let sends = 0;
  api.sendDocument = async (...args: unknown[]) => {
    calls.push({ method: "sendDocument", args });
    if (++sends === 2) throw new Error("Telegram unavailable");
    return { message_id: 20 };
  };
  await assert.rejects(
    processor.process(
      deliveryJob([attachment("big.pdf"), attachment("small.pdf")])
    ),
    /Telegram unavailable/
  );
  assert.equal(sends, 2);
  assert.equal(
    calls.some(
      call =>
        call.method === "sendMediaGroup" || call.method === "deleteMessage"
    ),
    false
  );
  assert.deepEqual(links, []);
  assert.deepEqual(cleaned, [
    "/tmp/enc-big.pdf.pdf",
    ...parts.map(part => part.tempFilePath),
    "/tmp/enc-small.pdf.pdf",
  ]);
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

test("a distinct recovery failure propagates for a lone GrammyError", async () => {
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
  const recoveryFailure = new Error("chat repository failed");
  const { api, grammyRecovery, processor } = createHarness({
    grammyErrorHandler: async () => {
      throw recoveryFailure;
    },
  });
  api.sendDocument = async () => {
    throw grammyFailure;
  };

  const caught = await processor
    .process(deliveryJob([attachment("a.pdf")]))
    .catch((error: unknown) => error);

  assert.equal(grammyRecovery.length, 1);
  assert.strictEqual(grammyRecovery[0]?.error, grammyFailure);
  assert.strictEqual(caught, recoveryFailure);
});

test("a distinct recovery failure joins the combined failure", async () => {
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
  const recoveryFailure = new Error("chat repository failed");
  const { api, grammyRecovery, processor } = createHarness({
    cleanupFailures: { "/tmp/enc-a.pdf.pdf": cleanupFailure },
    grammyErrorHandler: async () => {
      throw recoveryFailure;
    },
  });
  api.sendDocument = async () => {
    throw grammyFailure;
  };

  const caught = await processor
    .process(deliveryJob([attachment("a.pdf")]))
    .catch((error: unknown) => error);

  assert.equal(grammyRecovery.length, 1);
  assert.strictEqual(grammyRecovery[0]?.error, grammyFailure);
  assert.ok(caught instanceof AggregateError);
  assert.equal(caught.errors.length, 3);
  assert.strictEqual(caught.errors[0], grammyFailure);
  assert.strictEqual(caught.errors[1], cleanupFailure);
  assert.strictEqual(caught.errors[2], recoveryFailure);
  assert.strictEqual(caught.cause, grammyFailure);
  assert.match(
    caught.message,
    /recovery failed after attachment delivery and cleanup failures/
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
