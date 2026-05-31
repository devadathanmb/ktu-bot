import { readFileSync } from "node:fs";
import { z } from "zod";

const dbConfigSchema = z
  .object({
    DATABASE_URI: z.string(),
    PGSSLMODE: z.enum(["disable", "require", "verify-full"]),
    DATABASE_CA_CERTIFICATE: z.string().optional(),
    DATABASE_CA_CERTIFICATE_PATH: z.string().optional(),
  })
  .superRefine((config, ctx) => {
    if (config.PGSSLMODE !== "verify-full") return;

    // Full verification needs a CA bundle. Use `require` when the deployment
    // needs encrypted-but-unverified TLS for providers with mismatched certs.
    if (
      !config.DATABASE_CA_CERTIFICATE &&
      !config.DATABASE_CA_CERTIFICATE_PATH
    ) {
      ctx.addIssue({
        path: ["DATABASE_CA_CERTIFICATE"],
        code: "custom",
        message:
          "DATABASE_CA_CERTIFICATE or DATABASE_CA_CERTIFICATE_PATH required when PGSSLMODE is 'verify-full'",
      });
    }

    if (config.DATABASE_CA_CERTIFICATE_PATH) {
      try {
        readFileSync(config.DATABASE_CA_CERTIFICATE_PATH, "utf-8");
      } catch {
        ctx.addIssue({
          path: ["DATABASE_CA_CERTIFICATE_PATH"],
          code: "custom",
          message: `Cannot read CA certificate file at ${config.DATABASE_CA_CERTIFICATE_PATH}`,
        });
      }
    }
  })
  .transform(config => {
    if (config.PGSSLMODE === "disable") {
      return { ...config, SSL_CONFIG: false };
    }

    // Prefer file path over env var for CA cert
    const ca = config.DATABASE_CA_CERTIFICATE_PATH
      ? readFileSync(config.DATABASE_CA_CERTIFICATE_PATH, "utf-8")
      : config.DATABASE_CA_CERTIFICATE || undefined;

    return {
      ...config,
      SSL_CONFIG: {
        rejectUnauthorized: config.PGSSLMODE === "verify-full",
        ca,
      },
    };
  });

const DbConfigBase = dbConfigSchema.parse({
  DATABASE_URI: process.env.DATABASE_URI,
  PGSSLMODE: process.env.PGSSLMODE,
  DATABASE_CA_CERTIFICATE: process.env.DATABASE_CA_CERTIFICATE,
  DATABASE_CA_CERTIFICATE_PATH: process.env.DATABASE_CA_CERTIFICATE_PATH,
});

export const DbConfig = {
  ...DbConfigBase,
};
