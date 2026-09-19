import logger from "../../utils/logger.js";

export function setupGracefulShutdown(stop: () => Promise<void>) {
  const onShutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    try {
      await stop();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void onShutdown("SIGTERM"));
  process.on("SIGINT", () => void onShutdown("SIGINT"));
}
