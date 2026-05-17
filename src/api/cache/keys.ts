import { createHash } from "node:crypto";

export function createCacheKey(
  method: string,
  url: string,
  body?: unknown
): string {
  const bodyHash = body ? hashBody(body) : "no-body";
  return `${method}:${url}:${bodyHash}`;
}

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

export function isPathExcluded(url: string, excludePaths: string[]): boolean {
  const parsed = new URL(url);
  const pathWithQuery = parsed.pathname + parsed.search;
  return excludePaths.some(
    excluded =>
      parsed.pathname.endsWith(excluded) || pathWithQuery.endsWith(excluded)
  );
}

function hashBody(body: unknown): string {
  const stableBody = stableStringify(body);
  return createHash("sha256").update(stableBody).digest("hex").slice(0, 16);
}

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
