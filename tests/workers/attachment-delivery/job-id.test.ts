import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAttachmentJobId,
  type AttachmentJobIdInput,
} from "../../../src/workers/attachment-delivery/job-id.js";

function input(
  overrides: Partial<AttachmentJobIdInput> = {}
): AttachmentJobIdInput {
  return {
    chatId: 7,
    requestedByUserId: 11,
    context: "calendar",
    statusMessageId: 40,
    encryptIds: ["enc-a"],
    ...overrides,
  };
}

test("job id is stable across attachment order", () => {
  assert.equal(
    buildAttachmentJobId(input({ encryptIds: ["enc-a", "enc-b"] })),
    buildAttachmentJobId(input({ encryptIds: ["enc-b", "enc-a"] }))
  );
});

test("job id is acceptable to BullMQ custom-id validation", () => {
  // BullMQ rejects custom ids containing `:` (and pure integers); every add
  // would fail at runtime, so assert the constraint directly, including with
  // hostile segment values.
  for (const id of [
    buildAttachmentJobId(input()),
    buildAttachmentJobId(input({ context: "a:b", encryptIds: ["x:y", "z"] })),
  ]) {
    assert.ok(!id.includes(":"), `id contains colon: ${id}`);
    assert.ok(Number.isNaN(Number(id)), `id is numeric: ${id}`);
  }
});

test("job id separates tap, user, chat, context, and file", () => {
  const base = buildAttachmentJobId(input());
  assert.notEqual(base, buildAttachmentJobId(input({ statusMessageId: 41 })));
  assert.notEqual(base, buildAttachmentJobId(input({ requestedByUserId: 12 })));
  assert.notEqual(base, buildAttachmentJobId(input({ chatId: 8 })));
  assert.notEqual(base, buildAttachmentJobId(input({ context: "syllabus" })));
  assert.notEqual(base, buildAttachmentJobId(input({ encryptIds: ["enc-b"] })));
});
