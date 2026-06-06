# AGENTS.md

Project-specific rules for coding agents. Keep this file focused on instructions that prevent common mistakes; use [`docs/working.md`](docs/working.md) for architecture details.

## Quick Context

- GrammY Telegram bot with BullMQ background workers.
- PostgreSQL via Drizzle ORM for persistence; Redis powers BullMQ queues.
- Docker Compose files live under `docker/compose/`.

## Commands

- Start the full dev stack:
  ```bash
  docker compose -f docker/compose/compose.dev.yaml up --build
  ```
- Use `pnpm` for project scripts and dependency operations.
- Use `pnpm exec <command>` for project-local binaries, for example `pnpm exec tsc --noEmit`.
- Do not use `npx` in this repository.
- Before finishing TypeScript changes, run `pnpm exec tsc --noEmit`; run `pnpm exec eslint src/**/*.ts` when lint-sensitive code changed.

## TypeScript and Style

- Pure ESM with `moduleResolution: "NodeNext"`. Local imports must include `.js` extensions even though source files are `.ts`.
- TypeScript is strict. Watch especially for `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, unused symbols, missing `override`, and incomplete return paths.
- Do not introduce `any`; use `unknown` and narrow with type guards.
- Use GrammY's `fmt` template tag for formatted bot messages, and `joinWithNewlines()` for multi-line text.
- Environment access belongs in Zod-backed config modules under `src/configs/`. Do not add new direct `process.env` reads elsewhere.

## API and Caching

- KTU services use the shared Got clients from `src/api/client.ts`.
- KTU services default to `cachedApiClient`. Workers that need fresh KTU data should pass `baseApiClient` through supported service params.
- Never pass `cache: false` to Got. Use the service `apiClient` dependency-injection parameter instead.
- Large attachment endpoints are intentionally excluded from the in-memory cache; do not bypass this by adding ad-hoc caching around attachment downloads.

## Bot and GrammY

- Before changing GrammY APIs, plugins, middleware ordering, or callback-query handling, check the GrammY docs first.
- Main bot composition lives in `src/bot/bot.ts`; worker bot creation lives in `src/bot/utils/create-worker-bot.ts`.
- In bot/composer code, use `ctx.api`. In workers, use the worker bot's raw `bot.api`/`this.getBot().api` unless middleware is intentionally configured.
- Callback-query composers should use `createComposerErrorBoundary([...sessionKeys])`. Capture the returned protected composer and register handlers on it; middleware registered on the original composer is not protected.
- Telegram rate limits are undocumented. Broadcast processing intentionally uses low concurrency; on `retry_after`, pause the queue and re-throw so BullMQ retries.

## Errors and Logging

- Bot-facing errors should extend `BotError` when they need a safe `userMessage`.
- Composer boundaries wrap already-notified failures in `HandledBotError`; avoid notifying users twice.
- Use pino from `src/utils/logger.ts` for logs.
- Log errors as structured fields, preferably `{ err: error }`; do not manually destructure errors.
- Do not log and throw in the same layer. Log at the boundary, or throw upward.
- Keep log messages sentence-case with no trailing period. Put identifiers in structured fields, not template strings.
- Include useful correlation context: `chatId`/`userId` in bot code, `jobId`/`queueName`/`workerName` in workers, and `service`/`url` in API code.
