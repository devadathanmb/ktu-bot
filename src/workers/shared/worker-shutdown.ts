import type { WorkerControl } from "./worker-runtime.js";

export interface WorkerShutdownDeps {
  closeDB: () => Promise<void>;
}

/**
 * Standard worker shutdown: close the BullMQ worker and its queue before the
 * database connection, as the runtime requires.
 */
export function createWorkerShutdown(
  worker: WorkerControl,
  deps: WorkerShutdownDeps
): () => Promise<void> {
  return async () => {
    await worker.close();
    await deps.closeDB();
  };
}
