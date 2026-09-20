import logger from "./utils/logger.js";

export type ShutdownTrigger =
  | { type: "signal"; name: NodeJS.Signals }
  | { type: "failure"; source: "runner" | "startup" };

export interface BotShutdownDeps {
  closeMonitoringServer: () => Promise<void>;
  closeRunner: () => Promise<void>;
  closeAttachmentDeliveryQueue: () => Promise<void>;
  closeDB: () => Promise<void>;
  exit: (code: number) => void;
}

/**
 * Single idempotent shutdown path for the bot process. Overlapping triggers
 * share one cleanup run. Every closeable is attempted even when an earlier
 * close fails, and the process only exits 0 for a clean signal shutdown.
 */
export function createBotShutdown(
  deps: BotShutdownDeps
): (trigger: ShutdownTrigger) => Promise<void> {
  let shutdown: Promise<void> | undefined;

  return (trigger: ShutdownTrigger): Promise<void> => {
    shutdown ??= runShutdown(trigger, deps);
    return shutdown;
  };
}

async function runShutdown(
  trigger: ShutdownTrigger,
  deps: BotShutdownDeps
): Promise<void> {
  if (trigger.type === "signal") {
    logger.info({ signal: trigger.name }, "Shutting down gracefully");
  } else {
    logger.info({ cause: trigger.source }, "Shutting down after failure");
  }

  let failed = trigger.type === "failure";

  const steps: ReadonlyArray<readonly [string, () => Promise<void>]> = [
    ["monitoring server", deps.closeMonitoringServer],
    ["bot runner", deps.closeRunner],
    ["attachment delivery queue", deps.closeAttachmentDeliveryQueue],
    ["database", deps.closeDB],
  ];

  for (const [resource, close] of steps) {
    try {
      await close();
    } catch (error) {
      failed = true;
      logger.error({ err: error, resource }, "Shutdown step failed");
    }
  }

  deps.exit(failed ? 1 : 0);
}
