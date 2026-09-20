// Test bootstrap, loaded before test files via `--import ./tests/setup.ts`.
// Unit tests never open real connections, but importing repository modules
// parses DB config at load time. Dummy values keep `pnpm test` working
// without a populated environment; real values are respected when present.
process.env.DATABASE_URI ??= "postgres://localhost:5432/ktu-bot-test";
process.env.PGSSLMODE ??= "disable";
