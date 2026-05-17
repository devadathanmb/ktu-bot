import { createHash } from "node:crypto";

// Builds a unique cache key from the request method, URL, and body.
// The body is hashed (SHA-256, truncated to 16 chars) so that POST
// requests with different payloads don't collide on the same URL.
// Method is included so GET and POST to the same endpoint stay separate.
export function createCacheKey(
  method: string,
  url: string,
  body?: unknown
): string {
  const bodyHash = body ? hashBody(body) : "no-body";
  return `${method}:${url}:${bodyHash}`;
}

// Resolves the TTL for a URL by matching its pathname against the
// configured endpoint suffixes. Uses endsWith() so query parameters
// don't interfere with the lookup.
export function getTtlForUrl(
  url: string,
  endpointTtls: Record<string, number>,
  defaultTtl: number
): number {
  const pathname = new URL(url).pathname;
  for (const [suffix, ttl] of Object.entries(endpointTtls)) {
    if (pathname.endsWith(suffix)) {
      return ttl;
    }
  }
  return defaultTtl;
}

// Checks whether a URL should bypass the cache. Matches both pathname
// and full path-with-query so that endpoints with query params (like
// the reCAPTCHA check) are correctly excluded.
export function isPathExcluded(url: string, excludePaths: string[]): boolean {
  const parsed = new URL(url);
  const pathWithQuery = parsed.pathname + parsed.search;
  return excludePaths.some(
    excluded =>
      parsed.pathname.endsWith(excluded) || pathWithQuery.endsWith(excluded)
  );
}

// Produces a short, deterministic hash of the request body.
// Truncated to 16 hex chars — enough to avoid collisions in practice
// while keeping cache keys compact.
function hashBody(body: unknown): string {
  const stableBody = stableStringify(body);
  return createHash("sha256").update(stableBody).digest("hex").slice(0, 16);
}

// Stringifies an object with sorted keys so that {a:1, b:2} and
// {b:2, a:1} produce the same cache key. Handles nested objects
// and arrays recursively.
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(
    key =>
      `${JSON.stringify(key)}:${stableStringify(
        (obj as Record<string, unknown>)[key]
      )}`
  );
  return `{${pairs.join(",")}}`;
}
