import { z } from "zod";

const logConfigSchema = z.object({
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("debug"),
});

const LogConfig = logConfigSchema.parse({
  LOG_LEVEL: process.env.LOG_LEVEL || "debug",
});

export { LogConfig };
