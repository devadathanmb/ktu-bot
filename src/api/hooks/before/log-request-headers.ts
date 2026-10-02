// Intentionally NOT wired into any API client. Do not delete as dead code.
//
// Debug-only hook that logs the method, URL, and final headers of every
// outgoing request. It is kept out of the clients because it logs on every
// KTU call (very noisy) and the headers include the single-use Turnstile
// token, so it must never ship enabled.
//
// To use it while debugging, add it to `beforeRequest` in src/api/client.ts
// AFTER `addXTokenHeader`, so it sees the final headers. Remove it again
// before committing.

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
