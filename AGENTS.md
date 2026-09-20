# AGENTS.md

GrammY Telegram bot + BullMQ workers. PostgreSQL (Drizzle), Redis (queues). Compose files: `docker/compose/`.

## Commands

- Dev stack: `docker compose -f docker/compose/compose.dev.yaml up --build`
- `pnpm test` (all) or one file: `node --import tsx --import ./tests/setup.ts --test tests/<path-mirroring-src>/<file>.test.ts`. Tests live at the `tests/` path mirroring the `src/` directory of the unit under test; filenames are kept stable and may cover more than one module (`setup.ts` provides the dummy env). Run the suite matching the area changed: token-solver, syllabus-views, exam-timetable, calendar-announcement-views, recurring-schedules (double-setup keeps one scheduler per job), announcements-notify-orchestration, inline-query, data-sync.
- After TS changes: `pnpm exec tsc --noEmit`. Run `pnpm lint` for lint-sensitive code. Use `pnpm exec`, never `npx`.

## TypeScript

- Pure ESM (`NodeNext`): local imports need `.js` suffixes. Strict mode: watch `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, unused symbols, missing `override`, incomplete return paths.
- No `any`; narrow `unknown` with guards. Bot text via GrammY `fmt` + `joinWithNewlines()`.
- Env only in Zod-backed `src/configs/`; no new `process.env` elsewhere.

## API

- KTU calls go through Got clients in `src/api/client.ts`; import services via `src/api/services/<ktu|file|llm|betteruptime>`. Only the announcements-notify worker imports `llm`.
- `cachedApiClient` is default; workers needing fresh data pass `baseApiClient` via the service `apiClient` param. Never pass `cache: false`.
- The hook (`src/api/hooks/before/add-x-token-header.ts`) only gates on the KTU base URL and runs after the cache hook, so cache hits never mint a single-use Turnstile token; solver failures throw instead of sending a tokenless request. Attachment endpoints stay uncached. No ad-hoc caching around downloads.

## Bot

- Check GrammY docs before touching framework APIs, middleware order, or callback handling. Main composition in `src/bot/bot.ts`; workers use minimal `create-worker-bot()` (`ctx.api` in composers, raw `bot.api` in worker processors).
- Callback composers use `createComposerErrorBoundary([...sessionKeys])` and register on the returned composer. Syllabus download IDs are indices into the original API response, not the filtered page; preserve existing callback prefixes. API pages arrive paginated; render as received, never re-slice locally. Inline result prefixes (`ann:`, `cal:`, `tt:`) and queued attachment payloads are stable.
- Timetable downloads require nonblank `attachmentId` + `fileName` + `encryptId`, preserved verbatim. Broadcasts run at concurrency 1; on `retry_after`, pause the queue and re-throw for BullMQ retry.

## Workers

- Each worker owns its `startup.ts` (init, scheduling); processors in `worker.ts` only process jobs and do not inherit a lifecycle base class. Share `worker-runtime.ts` / `worker-shutdown.ts` / `start-worker.ts`; close worker and queue before the database.
- Recurring jobs only via `upsertJobScheduler` (`shared/recurring-schedules.ts`) with stable IDs that never encode the cron pattern; never `queue.add(..., { repeat })`. Setup removes legacy repeat definitions for the same logical job names only.
- Keep queue names, job IDs, payloads, concurrency, retry behavior stable. Keep announcement fetch results local to a job; orchestration owns job building via narrow DB/bot/queue functions. Data-sync initial-sync failures must propagate, never silently schedule nothing. Announcement `startup.ts` builds `LLMService` and injects it; the processor never constructs it. Its startup installs `apiThrottler()` then `autoRetry({ maxRetryAttempts: 5 })`. Enqueue broadcasts before replacing the notify buffer.
- Attachment-delivery startup still needs `initDB()` (error recovery writes chats/subs). Temp-file lifecycle lives in `src/utils/attachment-download.ts`; `file-utils.ts` stays generic.

## Errors and Logging

- User-facing errors extend `BotError` (`userMessage`); already-notified failures become `HandledBotError`. Never notify twice.
- Pino via `src/utils/logger.ts`, `{ err }` field, no manual destructuring. Log at the boundary or throw, never both. Sentence-case, no trailing period; IDs in fields, not strings. Include `chatId`/`userId` (bot), `jobId`/`queueName`/`workerName` (workers), `service`/`url` (API).
