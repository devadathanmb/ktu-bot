import { LRUCache } from "lru-cache";
import type { CacheConfig, CachedEntry } from "./types.js";
import logger from "../../utils/logger.js";

export class APICache {
  private cache: LRUCache<string, CachedEntry>;

  constructor(config: CacheConfig) {
    this.cache = new LRUCache<string, CachedEntry>({
      max: config.maxEntries,
      ttl: config.defaultTTL,
      // Automatically purge expired entries so the cache doesn't
      // accumulate dead weight between requests.
      ttlAutopurge: true,
    });
  }

  get(key: string): CachedEntry | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      logger.debug({ key }, "Cache hit");
    } else {
      logger.debug({ key }, "Cache miss");
    }
    return entry;
  }

  set(key: string, entry: CachedEntry, ttl?: number): void {
    this.cache.set(key, entry, ttl !== undefined ? { ttl } : undefined);
    logger.debug({ key, ttl }, "Cached response");
  }

  // Used when a non-200 response arrives — we invalidate so the next
  // request doesn't get a stale 200 from a different key collision.
  delete(key: string): void {
    this.cache.delete(key);
    logger.debug({ key }, "Cache invalidated");
  }

  clear(): void {
    this.cache.clear();
    logger.info("Cache cleared");
  }
}
