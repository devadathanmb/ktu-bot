# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project

A GrammY-based Telegram bot serving KTU (Kerala Technological University) students. The system consists of a long-polling bot and several BullMQ background workers, all orchestrated via Docker Compose. PostgreSQL (Drizzle ORM) for persistence, Redis (BullMQ) for job queues.

## Local Development

```bash
docker compose -f docker/compose/compose.dev.yaml up --build
```

This starts all services (bot, workers, PostgreSQL, Redis, Bull Board on :3010) with hot-reload.

## Package Manager

- Use `pnpm` for project scripts and dependency operations.
- Use `pnpm exec <command>` for project-local binaries, for example:
  ```bash
  pnpm exec tsc --noEmit
  ```
- Use `pnpx <package>` only when you need to run a package temporarily from the registry and it is not already installed in this project.
- Do not use `npx` in this repository.

## How It Works

For detailed architecture, data flow, and worker responsibilities, read [`docs/working.md`](docs/working.md). Do **not** repeat that information here - refer to it on demand when you need deeper context.

## TypeScript Conventions

### Module System

- Pure ESM (`"type": "module"` in package.json).
- Module resolution: `NodeNext`. **All local imports MUST use `.js` extensions** even though source files are `.ts`:
  ```ts
  import { BotError } from "../errors/bot-errors.js";
  ```
- Third-party imports do NOT use `.js`.

### Strictness

`tsconfig.json` enables full strict mode plus:

- `noUncheckedIndexedAccess` - all indexed access includes `undefined`.
- `exactOptionalPropertyTypes` - `{ key?: string }` forbids passing `undefined`.
- `noUnusedLocals`, `noUnusedParameters` - unused variables are errors. Prefix with `_` to suppress.
- `noImplicitOverride` - must use `override` keyword on class overrides.
- `noImplicitReturns` - all code paths must return.

### Code Style

- **ESLint**: Flat config with `typescript-eslint` type-checked rules. `no-floating-promises: error`, `no-unused-vars` (with `_` prefix exception).
- **`any` is strictly banned**. Never use `any`. Type everything properly - use `unknown` if the type is truly unknown and narrow it with type guards.
- **Caching**: The cached Got client is in `src/api/client.ts`. Service functions accept an optional `apiClient?: Got` parameter (dependency injection). Workers pass `baseApiClient` to bypass cache. Never pass `cache: false` to Got's built-in cache option — use the `apiClient` parameter instead.
- **Formatting strings**: Use GrammY's `fmt` template literal tag (from `@grammyjs/parse-mode`). Use `joinWithNewlines()` for multi-line messages.
- **Prettier** is enforced by the pre-commit hook - you don't need to worry about formatting.
- **Naming**: Files/dirs use `kebab-case`. Functions `camelCase`. Classes/interfaces `PascalCase`. Exported configs `PascalCase`.
- **Barrel exports**: Every directory has an `index.ts` re-exporting all public members.

### Config Validation

All environment variables are validated at startup using **Zod v4** schemas in `src/configs/`. The pattern:

```ts
const schema = z.object({ ... });
export const Config = schema.parse({ ENV_VAR: process.env.ENV_VAR, ... });
```

Use `.superRefine()` for cross-field validation and `.transform()` for derived values. Never access `process.env` directly outside of config modules.

### API Layer and Caching

The project uses [Got](https://github.com/sindresorhus/got) as its HTTP client for all KTU API calls. The API layer is organized under `src/api/`:

- **`client.ts`** — Exports `cachedApiClient` (cached) and `baseApiClient` (uncached) Got instances. The cached client wraps the base client with in-memory response caching via `beforeRequest`/`afterResponse` hooks.
- **`services/`** — Each service function (e.g., `fetchPrograms`, `fetchAnnouncements`) accepts an optional `apiClient?: Got` parameter. When omitted, the cached client is used. Workers that need fresh data pass `baseApiClient`.
- **`cache/`** — In-memory caching layer using `lru-cache`. Bypasses Got's HTTP-semantics-based caching (which doesn't work with KTU's non-standard APIs) in favor of custom URL+body-hash cache keys with per-endpoint TTLs. Only 200 responses are cached; non-200 responses invalidate the cache entry. Attachment endpoints (`/getAttachments`, `/getAttachment`) are excluded from caching to avoid memory bloat from large base64 payloads.

**Cache configuration** is in `src/api/cache/config.ts` — per-endpoint TTLs and exclusion paths are defined there. To disable caching globally, edit `src/api/client.ts` and swap `createCachedApiClient(baseApiClient, CACHE_CONFIG)` for `baseApiClient`.

### Error Handling

- **`BotError`** (base class): carries `userMessage` - the safe-to-show-user message.
- **`KTUAPIError extends BotError`**: API errors with `statusCode`, `url`, `serviceName`.
- **`SessionNotFoundError extends BotError`**: Session expired, has a default user-friendly message.
- **`HandledBotError`**: Wraps an error that was already handled by a composer error boundary. Prevent double-notification.

**Error handling flow**:

1. Composer error boundaries catch errors, clean up loading messages from session, notify user, wrap in `HandledBotError`, and re-throw.
2. Global error handler catches everything. If it's a `HandledBotError`, it skips because the user was already notified. Otherwise sends a generic message.

When writing new composers, always apply: `.errorBoundary(createComposerErrorBoundary([...sessionKeys]))` on the composer handling callback queries. **Capture the return value** and register handlers on the protected composer; middleware on the original composer is not protected.

### Logging

Use **pino** (`import logger from "../../utils/logger.js"`). It has serializers for `err` and `error` keys.

- **Serialize errors with `err`**: `logger.error({ err: error, chatId }, "Failed")` - never destructure manually.
- **Never log and throw**: log at the boundary, or throw - not both.
- **Structured data, not template strings**: `logger.info({ jobId, workerName }, "Job completed")` not `` `Job ${job.id}...` ``.
- **Sentence case, no trailing periods**. Messages describe the event; identifiers live in the log object.
- **Include correlation context**:
  - Bot layer: `chatId`, `userId`
  - Worker layer: `jobId`, `queueName`, `workerName`
  - API layer: `service`, `url`

### Session

`BotContext` extends GrammY's `Context` with `HydrateFlavor`, `CommandsFlavor`, `EmojiFlavor`, and `SessionFlavor<SessionData>`. Session stores pagination state and message IDs for cleanup. Always type session keys with `keyof SessionData`.

## GrammY Best Practices

**Before making any changes involving GrammY APIs, plugins, or patterns**, look up the relevant documentation first:

- Main docs: https://grammy.dev
- Use `context7_query-docs` with library ID `/grammyjs/grammY` for code examples.
- Use `deepwiki_ask_question` with repo `grammyjs/grammY` for questions.

Common GrammY patterns in this codebase:

- **Composers**: Each feature is a `Composer<BotContext>` mounted in `src/bot/bot.ts`. Use `@grammyjs/commands` for command groups.
- **Plugins**: The project uses `auto-retry`, `commands`, `emoji`, `hydrate`, `parse-mode`, `ratelimiter`, `runner`, `transformer-throttler`. Check `package.json` for versions before adding new plugins.
- **API calls**: Always use `ctx.api` (the auto-retry-aware instance). For workers (no middleware), use the raw `bot.api` from a worker bot created via `createWorkerBot()`.
- **Media groups**: Max 10 files per `sendMediaGroup` call. Caption only on the first item of the first batch.
- **Rate limiting**: Telegram rate limits are undocumented. The broadcasts worker uses `concurrency: 1` to handle them safely. When you hit a `retry_after` error, pause the queue and re-throw for BullMQ retry.
