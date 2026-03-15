# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Development (hot-reload)
pnpm dev                    # Run bot only
pnpm dev:watch              # Run bot with file watch

# Type checking & linting
pnpm typecheck              # tsc --noEmit (no emit)
pnpm lint                   # ESLint
pnpm lint:fix               # ESLint with auto-fix
pnpm format                 # Prettier write
pnpm format:check           # Prettier check

# Build & production
pnpm build                  # tsc → dist/
pnpm start                  # node dist/index.js

# Database (requires DATABASE_* env vars)
pnpm db:generate            # Generate new Drizzle migration from schema changes
pnpm db:migrate             # Run pending migrations
pnpm db:push                # Push schema directly (dev only)
pnpm db:studio              # Drizzle Studio UI

# Run individual workers (dev)
pnpm workers:data-sync-worker-dev
pnpm workers:announcements-notify-worker-dev
pnpm workers:broadcasts-worker-dev
pnpm workers:attachment-delivery-worker-dev
pnpm services:bull-board-dev

# Docker (recommended for full local setup)
docker compose -f docker/compose.dev.yaml up --build          # All services
docker compose -f docker/compose.dev.yaml up ktu-bot-app --build  # Bot only
```

There are no tests in this codebase.

## Architecture

This is a GrammY-based Telegram bot that serves KTU (Kerala Technological University) students. It follows a **microservices architecture** with independent processes:

### Processes

| Process                     | Entry Point                                   | Role                                                                                 |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| Bot                         | `src/index.ts`                                | Main GrammY bot (long polling), handles all user interactions                        |
| Data Sync Worker            | `src/workers/data-sync/startup.ts`            | Periodically fetches KTU data (announcements, timetables, calendars) into PostgreSQL |
| Announcements Notify Worker | `src/workers/announcements/notify/startup.ts` | Monitors new announcements, sends filtered notifications to subscribed users         |
| Broadcasts Worker           | `src/workers/broadcasts/startup.ts`           | Queued mass message delivery                                                         |
| Attachment Delivery Worker  | `src/workers/attachment-delivery/startup.ts`  | Downloads KTU attachments and sends files asynchronously                             |
| Bull Board Service          | `src/services/bull-board/server.ts`           | Hono-based BullMQ dashboard on port 3010                                             |

Each process runs as a separate Docker container. Workers are **BullMQ** jobs backed by **Redis**. The DB is **PostgreSQL** accessed via **Drizzle ORM**.

### Source Layout

```
src/
├── index.ts                  # Bot entry point
├── bot/
│   ├── bot.ts                # Bot factory: createBot() / createBotWithMetrics()
│   ├── composers/            # GrammY Composer modules (feature slices)
│   │   ├── core/             # /start, /help, /search, /code, /apistatus
│   │   ├── lookups/          # Paginated lookups: announcements, timetables, calendars
│   │   ├── announcement-subscriptions/  # Subscription management flow
│   │   ├── inline-query/     # Inline search
│   │   ├── unhandled/        # Catch-all fallback
│   │   └── shared/error-boundary.ts  # Composer-level error boundary pattern
│   ├── handlers/             # global-error, rate-limit, chat-member, deprecated
│   └── middlewares/          # logging, session init, track-chat-id, metrics
├── workers/
│   ├── base/base-worker.ts   # Abstract base class for all BullMQ workers
│   └── {worker-name}/        # Each worker: queue.ts, worker.ts, startup.ts
├── api/
│   ├── client.ts             # got HTTP client with KTU API hooks
│   ├── hooks/                # before/after hooks (headers, x-token, logging)
│   └── services/             # ktu/, huggingface/, betteruptime/, file/
├── db/
│   ├── schema/               # Drizzle table definitions
│   ├── repositories/         # Repository pattern for DB access
│   ├── migrations/           # Generated SQL migrations
│   └── connection.ts         # initDB() / closeDB()
├── configs/                  # Config modules (validated env vars per service)
├── constants/                # Static data (course list, API URLs, stickers)
├── errors/                   # bot-errors, handled-bot-error
├── metrics/                  # Prometheus metric definitions and registry
├── monitoring/               # Health check + metrics Hono server
├── types/                    # BotContext, SessionData, service types
└── utils/                    # logger, formatting, bot helpers
```

### Key Patterns

**BotContext** (`src/types/bot.types.ts`): Extended GrammY context with `HydrateFlavor`, `CommandsFlavor`, `EmojiFlavor`, and `SessionFlavor<SessionData>`. Always use `BotContext` as the generic type parameter.

**Composer pattern**: Each feature is a `Composer<BotContext>` mounted in `bot.ts`. Use `.errorBoundary(createComposerErrorBoundary([...sessionKeys]))` on composers for consistent error handling and loading message cleanup.

**Worker pattern**: Extend `BaseWorker<TJobData>` and implement `processJob(job)`. Override `initializeWorkerSpecific()` to set up a bot instance, `onStartupComplete()` to schedule recurring jobs.

**Error handling**: `KTUAPIError` and `SessionNotFoundError` carry a `userMessage` shown to the user. Other errors are logged and show a generic fallback. `HandledBotError` wraps errors after handling so the global error handler can skip re-notifying the user.

**Imports**: Use `.js` extensions on all local imports (NodeNext module resolution). All modules use ESM (`"type": "module"`).

**Env config**: Each service/worker has its own env file in `env/dev/` (development) or a single `env/prod/.env` (production). Config is validated and typed in `src/configs/*.ts` files.

## Environment Setup

Minimum required env vars for local dev (see `env/dev/bot.env`):

- `BOT_TOKEN` — Telegram bot token from @BotFather
- `BOT_FILE_UPLOAD_CHANNEL_ID` — Channel ID for file uploads

Optional features:

- `env/dev/llm.env` — HuggingFace API key for AI-powered announcement relevancy filtering
- `env/dev/api.env` — UptimeRobot API key for `/apistatus` command

All other env files (db, redis, logging, etc.) come prefilled with Docker Compose defaults.
