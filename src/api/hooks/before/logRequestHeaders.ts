import type { BeforeRequestHook } from "got";
import logger from "../../../utils/logger.js";

// Hook to log request headers for debugging purposes
export const logRequestHeaders: BeforeRequestHook = options => {
  logger.debug(
    {
      url: options.url?.toString(),
      method: options.method,
      headers: options.headers,
    },
    "Request Headers"
  );
};
