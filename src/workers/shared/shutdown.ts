import logger from "../../utils/logger.js";

export interface GracefulShutdownDeps {
  stop: () => Promise<void>;
  exit: (code: number) => void;
}

export function createShutdownHandler(deps: GracefulShutdownDeps) {
  let shutdownStarted = false;

  return async (signal: NodeJS.Signals): Promise<void> => {
    // Signals can arrive together or repeatedly; only the first one shuts down.
    if (shutdownStarted) return;
    shutdownStarted = true;

    logger.info({ signal }, "Shutting down");
    try {
      await deps.stop();
      deps.exit(0);
    } catch (error) {
      logger.error({ err: error, signal }, "Shutdown failed");
      deps.exit(1);
    }
  };
}

export function setupGracefulShutdown(stop: () => Promise<void>): void {
  const onShutdown = createShutdownHandler({
    stop,
    exit: code => process.exit(code),
  });

  process.on("SIGTERM", () => void onShutdown("SIGTERM"));
  process.on("SIGINT", () => void onShutdown("SIGINT"));
}
