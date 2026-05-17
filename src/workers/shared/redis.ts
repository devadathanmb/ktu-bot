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
};

export const workerRedisConnectionOptions: ConnectionOptions = {
  ...baseRedisConnectionOptions,
  enableOfflineQueue: true, // Queue commands during reconnections
  maxRetriesPerRequest: null, // Required for BullMQ blocking operations
};
