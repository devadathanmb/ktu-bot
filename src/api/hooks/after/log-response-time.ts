import type { AfterResponseHook } from "got";
import logger from "../../../utils/logger.js";

// Hook to log response times using Got's native timing information
export const logResponseTime: AfterResponseHook = response => {
  // Got provides comprehensive timing information natively
  const { timings } = response;

  if (timings) {
    const url = response.url;
    const cached = response.isFromCache;
    const method = response.request.options.method;
    const statusCode = response.statusCode;
    const timestamps = {
      start: timings.start,
      end: timings.end,
    };
    const total = `${timings.phases.total}ms`;
    logger.info(
      {
        url,
        cached,
        method,
        statusCode,
        // Comprehensive timing breakdown
        // totalTime: `${timings.phases.total}ms`,
        // dnsLookup: `${timings.phases.dns}ms`,
        // tcpConnection: `${timings.phases.tcp}ms`,
        // tlsHandshake: `${timings.phases.tls}ms`,
        // firstByte: `${timings.phases.firstByte}ms`,
        // download: `${timings.phases.download}ms`,
        // Individual timestamps
        timestamps,
        total,
      },
      "API response time"
    );
  }

  return response;
};
