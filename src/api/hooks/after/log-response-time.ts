// KEPT for debugging — not wired into the API client.
// To use: import & add to afterResponse hooks in src/api/client.ts.

import type { AfterResponseHook } from "got";
import logger from "../../../utils/logger.js";

export const logResponseTime: AfterResponseHook = response => {
  const { timings } = response;

  if (timings) {
    const url = response.url;
    const cached = response.isFromCache;
    const method = response.request.options.method;
    const statusCode = response.statusCode;
    logger.info(
      {
        url,
        cached,
        method,
        statusCode,
        total: `${timings.phases.total}ms`,
        timestamps: { start: timings.start, end: timings.end },
      },
      "API response time"
    );
  }

  return response;
};
