import { z } from "zod";

const redisConfigSchema = z.object({
  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number().positive(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().nonnegative(),
  REDIS_TLS_ENABLED: z.coerce.boolean().default(false),
});

export const RedisConfig = redisConfigSchema.parse({
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: process.env.REDIS_DB,
  REDIS_TLS_ENABLED: Boolean(process.env.REDIS_TLS_ENABLED == "true"),
});
