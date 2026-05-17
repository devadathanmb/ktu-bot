import { LRUCache } from "lru-cache";
import type { CacheConfig, CachedEntry } from "./types.js";
import logger from "../../utils/logger.js";

export class APICache {
  private cache: LRUCache<string, CachedEntry>;

  constructor(config: CacheConfig) {
    this.cache = new LRUCache<string, CachedEntry>({
      max: config.max,
      ttl: config.defaultTtl,
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

  delete(key: string): void {
    this.cache.delete(key);
    logger.debug({ key }, "Cache invalidated");
  }

  clear(): void {
    this.cache.clear();
    logger.info("Cache cleared");
  }
}
