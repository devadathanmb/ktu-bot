import type { AfterResponseHook } from "got";
import logger from "../../../utils/logger.js";

// Hook to log response times using Got's native timing information
export const logResponseTime: AfterResponseHook = response => {
  // Got provides comprehensive timing information natively
  const { timings } = response;

  if (timings) {
    logger.info(
      {
        url: response.url,
        cached: response.isFromCache,
        method: response.request.options.method,
        statusCode: response.statusCode,
        // Comprehensive timing breakdown
        // totalTime: `${timings.phases.total}ms`,
        // dnsLookup: `${timings.phases.dns}ms`,
        // tcpConnection: `${timings.phases.tcp}ms`,
        // tlsHandshake: `${timings.phases.tls}ms`,
        // firstByte: `${timings.phases.firstByte}ms`,
        // download: `${timings.phases.download}ms`,
        // Individual timestamps
        timestamps: {
          start: timings.start,
          end: timings.end,
        },
        total: `${timings.phases.total}ms`,
      },
      "API Response Time"
    );
  }

  return response;
};
