import { Attachment } from "../../types/service.types.js";
import { createQueue } from "../shared/create-queue.js";
import {
  enqueueWithReconcile,
  withDeadline,
  type DeliveryQueuePort,
} from "./enqueue.js";
import { buildAttachmentJobId } from "./job-id.js";

export const ATTACHMENT_DELIVERY_QUEUE = "ATTACHMENT_DELIVERY_QUEUE";

export interface AttachmentDeliveryJob {
  chatId: number;
  /** Telegram user id that requested the download. Keys the job id. */
  requestedByUserId: number;
  attachments: Attachment[];
  statusMessageId: number;
  replyToMessageId?: number;
  context: string;
  sendViewAnotherMessage?: boolean;
}

export const attachmentDeliveryQueue = createQueue<AttachmentDeliveryJob>({
  name: ATTACHMENT_DELIVERY_QUEUE,
  defaultJobOptions: {
    removeOnFail: { count: 50 },
  },
});

// One extra command-timeout window on top of the first add: enough to ride
// out a single stalled roundtrip through reconciliation, still fail-fast.
const ENQUEUE_BUDGET_MS = 60_000;

export async function addAttachmentDeliveryJob(
  jobData: AttachmentDeliveryJob,
  port: DeliveryQueuePort = attachmentDeliveryQueue
) {
  const jobId = buildAttachmentJobId({
    chatId: jobData.chatId,
    requestedByUserId: jobData.requestedByUserId,
    context: jobData.context,
    statusMessageId: jobData.statusMessageId,
    encryptIds: jobData.attachments.map(attachment => attachment.encryptId),
  });
  // Total user-facing bound for one enqueue including reconciliation: at most
  // ~60s holding the per-chat lock even if every Redis roundtrip stalls for
  // its 30s command timeout. In-flight commands are not cancelled by the
  // race, so a late success still delivers; the deadline passed alongside
  // guarantees no new write starts after the caller stops waiting.
  return await withDeadline(
    enqueueWithReconcile(
      port,
      jobData,
      jobId,
      performance.now() + ENQUEUE_BUDGET_MS
    ),
    ENQUEUE_BUDGET_MS,
    `Attachment enqueue exceeded ${ENQUEUE_BUDGET_MS}ms`
  );
}
