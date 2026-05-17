// Cache configuration for the KTU API response layer.
// KTU APIs don't emit HTTP caching headers, so we bypass got's built-in
// cache entirely and manage TTLs per endpoint ourselves.
export interface CacheConfig {
  maxEntries: number; // Maximum number of cached responses before LRU eviction
  defaultTTL: number; // Fallback TTL (ms) when no endpoint-specific TTL matches
  // Per-endpoint TTLs keyed by URL pathname suffix — matched via endsWith()
  // so query params don't break the lookup.
  endpointTTLs: Record<string, number>;
  // Paths excluded from caching entirely (large payloads, anti-bot checks).
  excludePaths: string[];
}

// The shape stored in the LRU cache. We keep only what's needed to
// reconstruct a got-compatible Response object.
export interface CachedEntry {
  rawBody: Uint8Array;
  statusCode: number;
  headers: Record<string, string | string[]>;
}
