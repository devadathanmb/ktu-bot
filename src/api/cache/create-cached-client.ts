import { Buffer } from "node:buffer";
import type { Got } from "got";
import Response from "responselike";
import { APICache } from "./cache.js";
import { createCacheKey, getTtlForUrl, isPathExcluded } from "./keys.js";
import type { CacheConfig, CachedEntry } from "./types.js";
import logger from "../../utils/logger.js";

// Wraps a got instance with beforeRequest/afterResponse hooks that
// intercept the HTTP lifecycle. On beforeRequest we check the cache;
// on afterResponse we store successful responses. This replaces got's
// built-in cache because KTU APIs don't emit standard Cache-Control headers.
export function createCachedApiClient(
  baseApiClient: Got,
  config: CacheConfig
): Got {
  const cache = new APICache(config);

  return baseApiClient.extend({
    hooks: {
      // Return a synthetic Response from cache to short-circuit the request.
      // Returning undefined lets the request proceed normally.
      beforeRequest: [
        options => {
          const url = options.url?.toString();
          if (!url) return undefined;

          // Attachment endpoints and anti-bot checks are never cached.
          if (isPathExcluded(url, config.excludePaths)) return undefined;

          const key = createCacheKey(options.method, url, options.body);
          const cached = cache.get(key);
          if (!cached) return undefined;

          logger.debug({ key }, "Returning cached response");
          return createSyntheticResponse(url, cached);
        },
      ],
      // Cache 200 responses; invalidate on any other status to prevent
      // a future request from accidentally reusing a stale success.
      afterResponse: [
        response => {
          const url = response.request.options.url?.toString();
          if (!url) return response;

          if (isPathExcluded(url, config.excludePaths)) return response;

          const key = createCacheKey(
            response.request.options.method,
            url,
            response.request.options.body
          );

          if (response.statusCode === 200) {
            const ttl = getTtlForUrl(
              url,
              config.endpointTTLs,
              config.defaultTTL
            );
            cache.set(
              key,
              {
                rawBody: response.rawBody,
                statusCode: response.statusCode,
                headers: response.headers as Record<string, string | string[]>,
              },
              ttl
            );
          } else {
            cache.delete(key);
          }

          return response;
        },
      ],
    },
  });
}

// Reconstructs a got-compatible Response from a cached entry so
// beforeRequest can short-circuit without hitting the network.
function createSyntheticResponse(url: string, cached: CachedEntry): Response {
  // Flatten array header values — got expects comma-joined strings.
  const headers = Object.fromEntries(
    Object.entries(cached.headers).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(", ") : value,
    ])
  );

  return new Response({
    statusCode: cached.statusCode,
    headers,
    body: Buffer.from(cached.rawBody),
    url,
  });
}
