import { z } from "zod";

const broadcastsWorkerConfigSchema = z
  .object({
    HEALTHCHECK_PORT: z.coerce.number().positive(),
  })
  .transform(config => ({
    ...config,
    HEALTHCHECK: {
      MAX_FAILED_JOBS: 50,
      MAX_BACKLOG_JOBS: 100,
    },
  }));

export const BroadcastsWorkerConfig = broadcastsWorkerConfigSchema.parse({
  HEALTHCHECK_PORT: process.env.BROADCASTS_WORKER_HEALTHCHECK_PORT,
});
