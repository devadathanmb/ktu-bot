import { RedisConfig } from "../../configs/redis.js";
import type { ConnectionOptions } from "bullmq";

/**
 * Shared Redis connection configuration for BullMQ queues and workers
 */
export const redisConnection: ConnectionOptions = {
  host: RedisConfig.REDIS_HOST,
  port: RedisConfig.REDIS_PORT,
  ...(RedisConfig.REDIS_PASSWORD && { password: RedisConfig.REDIS_PASSWORD }),
  db: RedisConfig.REDIS_DB,
  enableOfflineQueue: false, // Fail fast when Redis is down
  ...(RedisConfig.REDIS_TLS_ENABLED && { tls: {} }), // Enable TLS when configured
};
