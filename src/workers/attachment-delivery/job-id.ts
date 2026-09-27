export interface AttachmentJobIdInput {
  chatId: number;
  requestedByUserId: number;
  context: string;
  statusMessageId: number;
  encryptIds: string[];
}

// Deterministic per-tap id: every tap sends its own status message first, so
// the id is unique per tap and never suppresses a later legitimate request.
// On an uncertain add outcome (notably a client-side command timeout, which
// ioredis reports without cancelling server-side), re-adding under the same
// id reconciles instead of blindly enqueueing a second delivery. Best effort
// within job retention: once completed/failed jobs are trimmed, an id can be
// reused, so this is not an exactly-once guarantee.
// BullMQ forbids `:` in custom ids, so segments are dash-delimited with any
// stray colons sanitized.
export function buildAttachmentJobId(input: AttachmentJobIdInput): string {
  const sanitize = (part: string | number): string =>
    String(part).replaceAll(":", "_");
  const attachmentIds = [...input.encryptIds].sort().join(",");
  return [
    "attachment",
    sanitize(input.chatId),
    sanitize(input.requestedByUserId),
    sanitize(input.context),
    sanitize(input.statusMessageId),
    sanitize(attachmentIds),
  ].join("-");
}
