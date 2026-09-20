import assert from "node:assert/strict";
import test from "node:test";
import type { Queue } from "bullmq";
import { GrammyError } from "grammy";
import {
  classifyWorkerGrammyError,
  handleWorkerGrammyError,
  type WorkerGrammyErrorKind,
} from "../../../../src/workers/shared/utils/telegram-error-utils.js";

function grammyError(errorCode: number, description: string): GrammyError {
  return new GrammyError(
    "telegram request failed",
    { ok: false, error_code: errorCode, description },
    "sendMessage",
    {}
  );
}

function classify(
  errorCode: number,
  description: string
): WorkerGrammyErrorKind {
  return classifyWorkerGrammyError(grammyError(errorCode, description));
}

test("deactivated accounts win over the generic 403 blocked condition", () => {
  assert.equal(
    classify(403, "Forbidden: user is deactivated"),
    "user_deactivated"
  );
  assert.equal(
    classify(400, "Bad Request: USER_DEACTIVATED"),
    "user_deactivated"
  );
});

test("blocked and kicked users classify as blocked", () => {
  assert.equal(
    classify(403, "Forbidden: bot was blocked by the user"),
    "user_blocked"
  );
  assert.equal(
    classify(403, "Forbidden: bot was kicked from the supergroup chat"),
    "user_blocked"
  );
  assert.equal(classify(400, "Bad Request: USER_IS_BLOCKED"), "user_blocked");
});

test("rate limits and unrecognized errors classify separately", () => {
  assert.equal(
    classify(429, "Too Many Requests: retry after 5"),
    "rate_limited"
  );
  assert.equal(classify(400, "Bad Request: chat not found"), "unhandled");
  assert.equal(classify(500, "Internal Server Error"), "unhandled");
});

test("unrecognized errors still propagate so the job can retry", async () => {
  const error = grammyError(400, "Bad Request: chat not found");

  const caught = await handleWorkerGrammyError(7, error, {} as Queue).catch(
    (failure: unknown) => failure
  );

  assert.strictEqual(caught, error);
});
