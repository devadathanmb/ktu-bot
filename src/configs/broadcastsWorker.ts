import { z } from "zod";

const broadcastsWorkerConfigSchema = z.object({
  HEALTHCHECK_PORT: z.coerce.number().positive(),
});

export const BroadcastsWorkerConfig = broadcastsWorkerConfigSchema.parse({
  HEALTHCHECK_PORT: process.env.BROADCASTS_WORKER_HEALTHCHECK_PORT,
});
