import type { BeforeRequestHook } from "got";
import logger from "../../../utils/logger.js";

// Hook to log request headers for debugging purposes
export const logRequestHeaders: BeforeRequestHook = options => {
  const url = options.url?.toString();
  const method = options.method;
  const headers = options.headers;
  logger.debug(
    {
      url,
      method,
      headers,
    },
    "Request headers"
  );
};
