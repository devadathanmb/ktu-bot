// KEPT for debugging — not wired into the API client.
// To use: import & add to beforeRequest hooks in src/api/client.ts.

import type { BeforeRequestHook } from "got";
import logger from "../../../utils/logger.js";

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
