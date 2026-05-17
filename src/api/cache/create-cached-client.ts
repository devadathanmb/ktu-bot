import { Buffer } from "node:buffer";
import type { Got } from "got";
import Response from "responselike";
import { APICache } from "./cache.js";
import { createCacheKey, getTtlForUrl, isPathExcluded } from "./keys.js";
import type { CacheConfig, CachedEntry } from "./types.js";
import logger from "../../utils/logger.js";

export function createCachedApiClient(
  baseApiClient: Got,
  config: CacheConfig
): Got {
  const cache = new APICache(config);

  return baseApiClient.extend({
    hooks: {
      beforeRequest: [
        options => {
          const url = options.url?.toString();
          if (!url) return undefined;

          if (isPathExcluded(url, config.excludePaths)) return undefined;

          const key = createCacheKey(options.method, url, options.body);
          const cached = cache.get(key);
          if (!cached) return undefined;

          logger.debug({ key }, "Returning cached response");
          return createSyntheticResponse(url, cached);
        },
      ],
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
              config.endpointTtls,
              config.defaultTtl
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

function createSyntheticResponse(url: string, cached: CachedEntry): Response {
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
