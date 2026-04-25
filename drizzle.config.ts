import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

function getCaCert(): string | undefined {
  if (process.env.DATABASE_CA_CERTIFICATE_PATH) {
    return readFileSync(process.env.DATABASE_CA_CERTIFICATE_PATH, "utf-8");
  }
  return process.env.DATABASE_CA_CERTIFICATE || undefined;
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/*",
  out: "./src/db/migrations",
  dbCredentials: {
    host: process.env.DATABASE_HOST!,
    port: parseInt(process.env.DATABASE_PORT!),
    user: process.env.DATABASE_USER!,
    password: process.env.DATABASE_PASSWORD!,
    database: process.env.DATABASE_NAME!,
    ssl: process.env.PGSSLMODE !== "disable" ? { ca: getCaCert() } : false,
  },

  verbose: true,
  strict: true,
});
