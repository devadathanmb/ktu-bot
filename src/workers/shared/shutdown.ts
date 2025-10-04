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
    } catch (error) {
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => onShutdown("SIGTERM"));
  process.on("SIGINT", () => onShutdown("SIGINT"));
}
