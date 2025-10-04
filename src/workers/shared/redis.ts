import { RedisConfig } from "../../configs/redis.js";
import type { ConnectionOptions } from "bullmq";

/**
 * Base Redis connection options shared between queues and workers
 */
const baseRedisConnectionOptions = {
  host: RedisConfig.REDIS_HOST,
  port: RedisConfig.REDIS_PORT,
  ...(RedisConfig.REDIS_PASSWORD && { password: RedisConfig.REDIS_PASSWORD }),
  db: RedisConfig.REDIS_DB,
  ...(RedisConfig.REDIS_TLS_ENABLED && { tls: {} }),
};

/**
 * Redis connection configuration for BullMQ Queues (producers)
 * - enableOfflineQueue: false for fail-fast behavior when adding jobs
 * - Useful for API endpoints where you want immediate feedback if Redis is down
 */
export const queueRedisConnectionOptions: ConnectionOptions = {
  ...baseRedisConnectionOptions,
  enableOfflineQueue: false, // Fail fast when Redis is down
};

/**
 * Redis connection configuration for BullMQ Workers (consumers)
 * - enableOfflineQueue: true to handle reconnections gracefully
 * - maxRetriesPerRequest: null required for blocking operations (BZPOPMIN)
 * - Workers need resilient connections to avoid errors during brief disconnects
 */
export const workerRedisConnectionOptions: ConnectionOptions = {
  ...baseRedisConnectionOptions,
  enableOfflineQueue: true, // Queue commands during reconnections
  maxRetriesPerRequest: null, // Required for BullMQ blocking operations
};
