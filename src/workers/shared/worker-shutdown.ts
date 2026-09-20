import { closeDB } from "../../db/connection.js";
import type { WorkerControl } from "./worker-runtime.js";

/**
 * Standard worker shutdown: close the BullMQ worker and its queue before the
 * database connection, as the runtime requires.
 */
export function createWorkerShutdown(
  worker: WorkerControl
): () => Promise<void> {
  return async () => {
    await worker.close();
    await closeDB();
  };
}
