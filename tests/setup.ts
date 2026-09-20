// Test bootstrap, loaded before test files via `--import ./tests/setup.ts`.
// Unit tests never open real connections, but importing repository modules
// parses DB config at load time. Dummy values keep `pnpm test` working
// without a populated environment; real values are respected when present.
process.env.DATABASE_URI ??= "postgres://localhost:5432/ktu-bot-test";
process.env.PGSSLMODE ??= "disable";
process.env.DATA_SYNC_WORKER_HEALTHCHECK_PORT ??= "3103";
process.env.REDIS_HOST ??= "localhost";
process.env.REDIS_PORT ??= "6379";
process.env.REDIS_DB ??= "0";
