import { z } from "zod";

const logConfigSchema = z.object({
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("debug"),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

const LogConfig = logConfigSchema.parse({
  LOG_LEVEL: process.env.LOG_LEVEL || "debug",
  NODE_ENV:
    (process.env.NODE_ENV as "development" | "production" | undefined) ??
    "development",
});

export { LogConfig };
