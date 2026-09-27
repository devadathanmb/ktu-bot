import { RedisConfig } from "../../configs/redis.js";
import type { ConnectionOptions } from "bullmq";

const baseRedisConnectionOptions = {
  host: RedisConfig.REDIS_HOST,
  port: RedisConfig.REDIS_PORT,
  ...(RedisConfig.REDIS_PASSWORD && { password: RedisConfig.REDIS_PASSWORD }),
  db: RedisConfig.REDIS_DB,
  ...(RedisConfig.REDIS_TLS_ENABLED && { tls: {} }),
};

export const queueRedisConnectionOptions: ConnectionOptions = {
  ...baseRedisConnectionOptions,
  enableOfflineQueue: false, // Fail fast when Redis is down
  // Bound queue-side Redis commands to 30s so a stalled call fails fast.
  // Keep this off the worker connection: its blocking operations require
  // maxRetriesPerRequest: null and must not be timed out.
  commandTimeout: 30_000,
};

export const workerRedisConnectionOptions: ConnectionOptions = {
  ...baseRedisConnectionOptions,
  enableOfflineQueue: true, // Queue commands during reconnections
  maxRetriesPerRequest: null, // Required for BullMQ blocking operations
};
