import { defineConfig } from "drizzle-kit";

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

    // Do not use SSL in local development
    ssl:
      process.env.PGSSLMODE != "disable"
        ? { ca: process.env.DATABASE_CA_CERTIFICATE! }
        : false,
  },

  verbose: true,
  strict: true,
});
