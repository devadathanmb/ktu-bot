export interface CacheConfig {
  max: number;
  defaultTtl: number;
  endpointTtls: Record<string, number>;
  excludePaths: string[];
}

export interface CachedEntry {
  rawBody: Uint8Array;
  statusCode: number;
  headers: Record<string, string | string[]>;
}
