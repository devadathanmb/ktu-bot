import logger from "../../utils/logger.js";

interface ShutdownHandler {
  stop(): Promise<void>;
}

export function setupGracefulShutdown(handler: ShutdownHandler) {
  const onShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    try {
      await handler.stop();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void onShutdown("SIGTERM"));
  process.on("SIGINT", () => void onShutdown("SIGINT"));
}
