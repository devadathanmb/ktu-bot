import logger from "../../utils/logger.js";
import type { AttachmentDeliveryJob } from "./queue.js";

// Narrow seam over the queue client so the reconcile branches are unit
// testable without a live Redis. BullMQ's Queue satisfies it structurally.
export interface DeliveryQueuePort {
  add(
    name: string,
    data: AttachmentDeliveryJob,
    opts: { jobId: string }
  ): Promise<{ id?: string }>;
  getJob(id: string): Promise<{ id?: string } | undefined>;
}

export async function enqueueWithReconcile(
  port: DeliveryQueuePort,
  jobData: AttachmentDeliveryJob,
  jobId: string,
  deadlineMs: number = Number.POSITIVE_INFINITY
): Promise<{ id?: string }> {
  try {
    const job = await port.add("attachment:deliver", jobData, { jobId });
    logEnqueuedJob(job.id, jobData, false);
    return job;
  } catch (firstError) {
    // The add may still have executed server-side (notably on a client-side
    // command timeout, which ioredis reports without cancelling). Look the
    // deterministic id up before enqueueing a second delivery: same tap,
    // same status message, so nothing is left orphaned.
    const existing = await port.getJob(jobId).catch(() => undefined);
    if (existing) {
      logEnqueuedJob(existing.id, jobData, true);
      return existing;
    }
    // Never start a new write after the caller's deadline: the budget race
    // in the caller may already have reported failure. Monotonic clock, so a
    // system-clock adjustment cannot reopen the window.
    if (performance.now() >= deadlineMs) throw firstError;
    try {
      const job = await port.add("attachment:deliver", jobData, { jobId });
      logEnqueuedJob(job.id, jobData, false);
      return job;
    } catch (retryError) {
      const raced = await port.getJob(jobId).catch(() => undefined);
      if (raced) {
        logEnqueuedJob(raced.id, jobData, true);
        return raced;
      }
      throw retryError;
    }
  }
}

// Bounds how long the caller waits. Already-issued commands are not
// cancelled by the race, so a late success still delivers; combined with the
// deadline gate above, no *new* write starts after the budget expires.
export async function withDeadline<T>(
  work: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });
  try {
    return await Promise.race([work, budget]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function logEnqueuedJob(
  jobId: string | undefined,
  jobData: AttachmentDeliveryJob,
  reconciled: boolean
): void {
  const { chatId, context } = jobData;
  logger.debug(
    {
      jobId,
      chatId,
      context,
      queueName: "ATTACHMENT_DELIVERY_QUEUE",
      reconciled,
    },
    "Added attachment delivery job"
  );
}
