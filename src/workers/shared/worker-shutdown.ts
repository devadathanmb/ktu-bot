import type { WorkerControl } from "./worker-runtime.js";

export interface WorkerShutdownDeps {
  closeMonitoringServer: () => Promise<void>;
  closeDB: () => Promise<void>;
}

function toError(failure: unknown): Error {
  return failure instanceof Error ? failure : new Error(String(failure));
}

/**
 * Standard worker shutdown: stop accepting monitoring requests, then close the
 * BullMQ worker and its queue before the database connection, as the runtime
 * requires. Every close is attempted even when an earlier one fails; the
 * collected failures are re-thrown so the shutdown handler exits non-zero.
 */
export function createWorkerShutdown(
  worker: WorkerControl,
  deps: WorkerShutdownDeps
): () => Promise<void> {
  return async () => {
    const failures: Error[] = [];

    const attempt = async (close: () => Promise<void>) => {
      try {
        await close();
      } catch (error) {
        failures.push(toError(error));
      }
    };

    await attempt(deps.closeMonitoringServer);
    await attempt(() => worker.close());
    await attempt(deps.closeDB);

    if (failures.length === 1) {
      throw failures[0]!;
    }
    if (failures.length > 1) {
      throw new AggregateError(failures, "Worker shutdown failed");
    }
  };
}
