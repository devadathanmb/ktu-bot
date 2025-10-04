import { z } from "zod";

const dbConfigSchema = z
  .object({
    DATABASE_URI: z.string(),
    PGSSLMODE: z.enum(["disable", "verify-full"]),
    DATABASE_CA_CERTIFICATE: z.string().optional(),
  })
  .superRefine((config, ctx) => {
    if (config.PGSSLMODE !== "disable" && !config.DATABASE_CA_CERTIFICATE) {
      ctx.addIssue({
        path: ["DATABASE_CA_CERTIFICATE"],
        code: "custom",
        message:
          "DATABASE_CA_CERTIFICATE is required when PGSSLMODE is not 'disable'",
      });
    }
  })
  .transform(config => {
    // Transform to include SSL config
    // If PGSSLMODE is 'disable', SSL config is false
    // Otherwise, set up SSL config with rejectUnauthorized false and CA must be provided
    return {
      ...config,
      SSL_CONFIG:
        config.PGSSLMODE === "disable"
          ? false
          : {
              rejectUnauthorized: false,
              ca: config.DATABASE_CA_CERTIFICATE
                ? config.DATABASE_CA_CERTIFICATE
                : undefined,
            },
    };
  });

const DbConfigBase = dbConfigSchema.parse({
  DATABASE_URI: process.env.DATABASE_URI,
  PGSSLMODE: process.env.PGSSLMODE,
  DATABASE_CA_CERTIFICATE: process.env.DATABASE_CA_CERTIFICATE,
});

export const DbConfig = {
  ...DbConfigBase,
};
