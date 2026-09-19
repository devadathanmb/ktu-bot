import { z } from "zod";

const tokenSolverConfigSchema = z.object({
  // Reachable from the bot's Docker network via the host gateway, where the
  // solver publishes port 5001.
  URL: z.string().url().default("http://172.17.0.1:5001"),
  TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export const TokenSolverConfig = tokenSolverConfigSchema.parse({
  URL: process.env.TOKEN_SOLVER_URL,
  TIMEOUT_MS: process.env.TOKEN_SOLVER_TIMEOUT_MS,
});
