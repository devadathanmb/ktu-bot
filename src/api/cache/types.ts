// Cache configuration for the KTU API response layer.
// KTU APIs don't emit HTTP caching headers, so we bypass got's built-in
// cache entirely and manage TTLs per endpoint ourselves.
export interface CacheConfig {
  maxEntries: number;
  defaultTTL: number;
  endpointTTLs: Record<string, number>;
  excludePaths: string[];
}

// The shape stored in the LRU cache. We keep only what's needed to
// reconstruct a got-compatible Response object.
export interface CachedEntry {
  rawBody: Uint8Array;
  statusCode: number;
  headers: Record<string, string | string[]>;
}
