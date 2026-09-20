# AGENTS.md

Project-specific rules for coding agents. Keep this file focused on instructions that prevent common mistakes; use [`docs/working.md`](docs/working.md) for architecture details.

## Quick Context

- GrammY Telegram bot with BullMQ background workers.
- PostgreSQL via Drizzle ORM for persistence; Redis powers BullMQ queues.
- Docker Compose files live under `docker/compose/`.
- When changing architecture or development workflows, review this file and `docs/working.md` and update affected guidance in the same change.
- For delegated implementation, prefer Terra medium or Luna high; keep assignments narrow and review their changes in the main agent.
- Antigravity CLI is also available for delegation: use `agy --help` and `agy models` to check invocation and model options, then `agy --print` for a bounded task. Review its output and changes in the main agent.
- Prefer a Medium reasoning model for routine `agy` implementation tasks to control credit use; batch closely related changes and avoid duplicate global checks.

## Commands

- Start the full dev stack:
  ```bash
  docker compose -f docker/compose/compose.dev.yaml up --build
  ```
- Use `pnpm` for project scripts and dependency operations.
- Use `pnpm exec <command>` for project-local binaries, for example `pnpm exec tsc --noEmit`.
- Do not use `npx` in this repository.
- Before finishing TypeScript changes, run `pnpm exec tsc --noEmit`; run `pnpm lint` when lint-sensitive code changed.
- Tests live in `tests/*.test.ts` on Node's built-in runner: run `pnpm test`. While iterating, target one file, for example `node --import tsx --test tests/token-solver.test.ts`.
- For token-solver or X-Token hook changes, run the token-solver suite (offline, stub fetch).
- For syllabus lookup changes, run the syllabus-views suite to check page rendering and attachment selection IDs offline.
- For timetable lookup changes, run the exam-timetable suite. Timetable API pages are already paginated; do not slice them again locally.
- For calendar or announcement lookup changes, run the calendar-announcement-views suite; these API pages also must not be sliced locally.
- For worker recurring-schedule changes, run the recurring-schedules suite; a real Redis check must call setup twice with different patterns and leave one scheduler per logical job.
- For announcement notification orchestration changes, run the announcements-notify-orchestration suite (offline, injects fake subscriber/attachment/queue/buffer functions).

## TypeScript and Style

- Pure ESM with `moduleResolution: "NodeNext"`. Local imports must include `.js` extensions even though source files are `.ts`.
- TypeScript is strict. Watch especially for `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, unused symbols, missing `override`, and incomplete return paths.
- Do not introduce `any`; use `unknown` and narrow with type guards.
- Use GrammY's `fmt` template tag for formatted bot messages, and `joinWithNewlines()` for multi-line text.
- Environment access belongs in Zod-backed config modules under `src/configs/`. Do not add new direct `process.env` reads elsewhere.

## API and Caching

- KTU services use the shared Got clients from `src/api/client.ts`.
- Import services through their domain entry point under `src/api/services/` (`ktu`, `file`, `llm`, `betteruptime`); do not recreate a mixed root barrel. Only the announcement notification worker may import the LLM domain.
- KTU services default to `cachedApiClient`. Workers that need fresh KTU data should pass `baseApiClient` through supported service params.
- Never pass `cache: false` to Got. Use the service `apiClient` dependency-injection parameter instead.
- `src/api/hooks/before/add-x-token-header.ts` only gates on the KTU base URL and attaches `X-Token`; solver HTTP communication and response validation live in `src/api/token-solver.ts`. Keep the token hook after the cache hook so cache hits never mint a single-use Turnstile token. Solver timeout, network, non-2xx, malformed JSON, or blank-token failures throw instead of sending a KTU request without a token.
- Large attachment endpoints are intentionally excluded from the in-memory cache; do not bypass this by adding ad-hoc caching around attachment downloads.

## Bot and GrammY

- Before changing GrammY APIs, plugins, middleware ordering, or callback-query handling, check the GrammY docs first.
- Main bot composition lives in `src/bot/bot.ts`. Broadcast and attachment workers use `src/bot/utils/create-worker-bot.ts`; announcement startup currently uses `createBot()` with throttler and auto-retry API transformers.
- In bot/composer code, use `ctx.api`. In worker processors, use the injected bot's raw `bot.api`.
- Callback-query composers should use `createComposerErrorBoundary([...sessionKeys])`. Capture the returned protected composer and register handlers on it; middleware registered on the original composer is not protected.
- Syllabus entry callback IDs are indices in the original API response, not the filtered or paginated list. Preserve that mapping and existing callback prefixes during refactors.
- Timetable `attachmentId` alone does not guarantee a download: require nonblank `fileName` and `encryptId` too, and preserve valid strings verbatim in queued jobs.
- Telegram rate limits are undocumented. Broadcast processing intentionally uses low concurrency; on `retry_after`, pause the queue and re-throw so BullMQ retries.

## Workers

- Keep dependency initialization and initial/recurring scheduling explicit in each worker's `startup.ts`; processors in `worker.ts` do not inherit a lifecycle base class.
- Register recurring jobs with `upsertJobScheduler` through `shared/recurring-schedules.ts`. Scheduler IDs are stable and never encode the cron pattern, so a changed schedule updates the existing entry. Do not use `queue.add(..., { repeat })`: it accumulates definitions and BullMQ later converts them into schedulers keyed by legacy hashes. Setup removes legacy repeat definitions for the same logical job names only.
- Reuse `shared/worker-runtime.ts` for BullMQ lifecycle and `shared/start-worker.ts` for monitoring/shutdown wiring. Close the worker and queue before the database.
- Attachment-delivery startup still needs `initDB()`: Telegram error recovery updates chat and subscription records.
- Attachment retrieval and its temp-file lifecycle live in `src/utils/attachment-download.ts`. Keep `src/utils/file-utils.ts` to generic filesystem helpers that know nothing about KTU endpoints or `AttachmentSource`.
- Preserve queue names, job IDs, payloads, concurrency, and retry behavior during structural refactors. Keep announcement fetch results local to a job and enqueue broadcasts before replacing the buffer.
- Announcements notify `startup.ts` constructs `LLMService` and passes it to `AnnouncementsNotifyProcessor` as an `AnnouncementClassifier`; the processor must not construct it. `notify/orchestration.ts` owns job building and the enqueue-before-buffer-replacement ordering and takes its database, bot, and queue behavior as narrow functions.

## Errors and Logging

- Bot-facing errors should extend `BotError` when they need a safe `userMessage`.
- Composer boundaries wrap already-notified failures in `HandledBotError`; avoid notifying users twice.
- Use pino from `src/utils/logger.ts` for logs.
- Log errors as structured fields, preferably `{ err: error }`; do not manually destructure errors.
- Do not log and throw in the same layer. Log at the boundary, or throw upward.
- Keep log messages sentence-case with no trailing period. Put identifiers in structured fields, not template strings.
- Include useful correlation context: `chatId`/`userId` in bot code, `jobId`/`queueName`/`workerName` in workers, and `service`/`url` in API code.
