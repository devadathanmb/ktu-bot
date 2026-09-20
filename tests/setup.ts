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
process.env.BOT_TOKEN ??= "test-token";
process.env.BOT_HEALTH_CHECK_PORT ??= "3000";
process.env.BOT_FILE_UPLOAD_CHANNEL_ID ??= "-1001";
process.env.UPTIME_ROBOT_API_KEY ??= "test-uptime-robot-key";
process.env.BETTER_UPTIME_API_TOKEN ??= "test-better-uptime-token";
process.env.BETTER_UPTIME_MONITOR_GROUP_ID ??= "test-monitor-group";
