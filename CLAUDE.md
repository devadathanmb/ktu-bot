# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is a **GrammY-based Telegram bot** with a microservices architecture running on Docker Compose. The system is organized into:

- **Bot Service** ([src/bot/](src/bot/)) - Main bot using GrammY framework with composers pattern
- **Background Workers** ([src/workers/](src/workers/)) - BullMQ-based services for notifications, broadcasts, and data sync
- **Supporting Services** ([src/services/](src/services/)) - Bull Board monitoring dashboard
- **API Layer** ([src/api/services/](src/api/services/)) - External integrations (KTU, LLM, file hosting)
- **Database Layer** ([src/db/](src/db/)) - Drizzle ORM with PostgreSQL
- **Configuration** ([src/configs/](src/configs/)) - Zod-validated environment configs

## Essential Commands

### Development

```bash
# Start all services with hot reload
docker compose -f docker-compose.dev.yaml down -v --remove-orphans && \
docker compose -f docker-compose.dev.yaml up --build

# Start only the bot (without workers)
docker compose -f docker-compose.dev.yaml up ktu-bot-app --build

# Run individual workers
docker compose -f docker-compose.dev.yaml up announcements-notify-worker --build
docker compose -f docker-compose.dev.yaml up data-sync-worker --build
docker compose -f docker-compose.dev.yaml up broadcasts-worker --build
docker compose -f docker-compose.dev.yaml up attachment-delivery-worker --build

# Local development without Docker
pnpm dev              # Start bot with tsx hot reload
pnpm start:dev        # Alias for dev
pnpm dev:watch        # Watch mode
```

### Database Operations

```bash
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Apply migrations
pnpm db:push          # Push schema changes
pnpm db:studio        # Open Drizzle Studio UI
```

### Code Quality

```bash
pnpm build            # TypeScript compilation
pnpm typecheck        # Type checking without emit
pnpm lint             # ESLint check
pnpm lint:fix         # Auto-fix linting issues
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting
```

### Workers (Local)

```bash
pnpm workers:announcements-notify-worker-dev    # Dev mode with hot reload
pnpm workers:broadcasts-worker-dev
pnpm workers:data-sync-worker-dev
pnpm workers:attachment-delivery-worker-dev
pnpm services:bull-board-dev                    # Bull Board dashboard
```

### Production

```bash
docker compose down -v --remove-orphans && docker compose up -d --build
```

## Critical Patterns & Conventions

### ES Modules

**IMPORTANT:** This project uses ES modules. Always use `.js` extensions in imports, even for TypeScript files:

```typescript
import { something } from "./utils/helper.js"; // ✅ Correct
import { something } from "./utils/helper"; // ❌ Wrong
```

### Configuration Pattern

All configs use Zod schemas for validation and type safety:

```typescript
// Pattern from src/configs/*.ts
const configSchema = z.object({...}).transform(config => ({...}));
export const Config = configSchema.parse({...});
```

### Service Wrapper Pattern

API services use `serviceWrapper` for consistent error handling:

```typescript
// Pattern in src/api/services/
import { serviceWrapper } from "../../utils/serviceWrapper.js";
export const myService = serviceWrapper("ServiceName", async (params) => {...});
```

### Database Repository Pattern

Follow repository pattern for all database operations:

- Repository classes in [src/db/repositories/](src/db/repositories/)
- Schema definitions in [src/db/schema/](src/db/schema/)
- Use transactions via [src/db/transactions.ts](src/db/transactions.ts) for complex operations
- Use Drizzle's upsert operations for sync logic

### Bot Composers Architecture

Bot features are organized as **composers** (not traditional handlers):

- Located in [src/bot/composers/](src/bot/composers/)
- Each feature gets its own composer directory with `composer.ts`
- **Order matters** in [src/bot/bot.ts](src/bot/bot.ts:37) - inline queries must come first, then chat-context composers
- Use `sequentialize(getSessionKey)` for long polling to prevent race conditions
- Commands are organized in command groups and registered via composers

### Worker Architecture (BullMQ)

Workers extend **BaseWorker** abstract class for consistent lifecycle management:

**Base Worker Pattern** ([src/workers/base/BaseWorker.ts](src/workers/base/BaseWorker.ts)):

```typescript
export class MyWorker extends BaseWorker<JobData> {
  constructor() {
    super("worker-name", QUEUE_NAME, queueInstance, {
      concurrency: 1,
      limiter: { max: 10, duration: 1000 },
    });
  }

  protected override initializeWorkerSpecific(): Promise<void> {
    // Setup bot, services, etc.
    this.bot = createBot();
    return Promise.resolve();
  }

  protected override async processJob(job: Job<JobData>): Promise<void> {
    // Core business logic
  }

  async getStatus() {
    /* Health check */
  }
}
```

**Worker Responsibilities:**

- Constructor accepts: `workerName`, `queueName`, `queue`, optional `config`
- Implement `processJob()` - core business logic
- Implement `getStatus()` - health check endpoint
- Optionally override `initializeWorkerSpecific()` - setup bot, services
- Optionally override `onStartupComplete()` - schedule initial/recurring jobs

**BaseWorker Handles:**

- Redis and database initialization
- BullMQ worker creation with concurrency/rate limiting
- Job processing with error handling wrapper
- Event handlers (completed, failed)
- Graceful shutdown

**Queue Configuration:**

- `DATA_SYNC_QUEUE` - Syncs KTU data (concurrency: 3, rate limited)
- `ANNOUNCEMENTS_NOTIFY_QUEUE` - New announcement notifications (concurrency: 1)
- `BROADCASTS_QUEUE` - Message delivery (concurrency: 1)
- `ATTACHMENT_DELIVERY_QUEUE` - Non-blocking file downloads (concurrency: 2)

**Worker Implementations:**

- [src/workers/announcements/notify/](src/workers/announcements/notify/) - Monitors for new announcements, filters by course, creates broadcast jobs
- [src/workers/broadcasts/](src/workers/broadcasts/) - Generic message delivery with rate limiting and error handling
- [src/workers/data-sync/](src/workers/data-sync/) - Syncs KTU data to local DB for full-text search
- [src/workers/attachment-delivery/](src/workers/attachment-delivery/) - Downloads and sends files asynchronously, prevents bot blocking

**Shared Utilities:**

- [src/workers/shared/utils/attachmentProcessor.ts](src/workers/shared/utils/attachmentProcessor.ts) - File upload/processing
- [src/workers/shared/redis.ts](src/workers/shared/redis.ts) - Redis connection configs
- [src/workers/shared/queueHealth.ts](src/workers/shared/queueHealth.ts) - Queue health checks
- [src/workers/shared/shutdown.ts](src/workers/shared/shutdown.ts) - Graceful shutdown handler

**Health Checks:**

- Each worker exposes health endpoints
- Monitor queue state (waiting, active, failed jobs)
- Health check utility in [src/utils/healthCheck.ts](src/utils/healthCheck.ts)

### Session Management

- Memory-based sessions with TTL (`BotConfig.BOT_SESSION_DATA_TTL`)
- Session key: `ctx.chat.id.toString()`
- Session data structure defined in [src/types/bot.types.ts](src/types/bot.types.ts)
- Sessions stored in Redis via enhanced storage

### File Handling

- Temporary files via [src/utils/fileUtils.ts](src/utils/fileUtils.ts)
- File uploads to external service via [src/api/services/file/](src/api/services/file/)
- Bot file channel: `BOT_FILE_UPLOAD_CHANNEL_ID` (must be negative number)

### Error Handling

- Global bot error handler in [src/bot/handlers/globalError.ts](src/bot/handlers/globalError.ts)
- Service-level error wrapping via `serviceWrapper`
- Structured logging with custom logger ([src/utils/logger.ts](src/utils/logger.ts))

### Queue Monitoring

**Bull Board** provides unified dashboard for all BullMQ queues:

- Standalone service on port 3010 (`http://localhost:3010`)
- Unified view of all queues across workers
- Real-time job monitoring, retry capabilities
- Implementation in [src/services/bull-board/](src/services/bull-board/)
- Can run/skip independently of workers

## Environment Configuration

Development uses split environment files in `dev/` directory (not gitignored):

- `bot.env` - Core bot configuration (requires `BOT_TOKEN`, `BOT_FILE_UPLOAD_CHANNEL_ID`)
- `db.env` - Database connection
- `redis.env` - Redis configuration
- `*-worker.env` - Worker-specific configs
- `api.env` - External services (UptimeRobot, file hosting)
- `llm.env` - AI-powered announcement filtering

Production uses single `.env` file (copy from `env.prod.example`).

## Key Technical Details

### GrammY Middleware Order

Middleware sequence is critical in [src/bot/bot.ts](src/bot/bot.ts:37):

1. Sequentialize (long polling only)
2. Session management
3. Logging & tracking
4. Hydration & emoji parser
5. Commands plugin
6. **Inline queries FIRST** (before chat-context composers)
7. Chat member updates
8. Deprecated commands
9. Feature composers (subscriptions, lookups)
10. Command groups
11. Unknown command handler
12. Inline result messages
13. Unhandled (should be last)
14. Global error handler

### Full-Text Search

- PostgreSQL full-text search configured at schema level
- Enables inline search across announcements, calendars, timetables
- Data synced locally because KTU APIs don't support search
- Query local DB instead of hitting KTU APIs

### Deprecated Features

- Old result checking commands (see [src/constants/bot.ts](src/constants/bot.ts))
- Handled via `deprecatedCommandHandler` in [src/bot/handlers/deprecated.ts](src/bot/handlers/deprecated.ts)

### Health Checks

Each service exposes health endpoints:

- Bot: port 3000
- Workers: ports 3001, 3002, 3003, 3004
- Bull Board: port 3010
- Check database and Redis connectivity

## Important Implementation Notes

### Auto-retry Mechanisms

- Bot API calls use `@grammyjs/auto-retry` plugin
- Workers use BullMQ built-in retry with exponential backoff
- Rate limiting handled via queue pausing in broadcasts worker

### Graceful Shutdown

All services implement proper shutdown:

- Runner stop for bot
- Queue cleanup for workers
- Database connection closure
- Configured in startup files

### TypeScript Configuration

- Strict mode enabled ([tsconfig.json](tsconfig.json))
- ES2022 target with NodeNext module resolution
- Output to `dist/` directory
- Source maps and declarations enabled

### Drizzle Configuration

- Schema in [src/db/schema/](src/db/schema/)
- Migrations in [src/db/migrations/](src/db/migrations/)
- PostgreSQL dialect
- SSL configurable via `PGSSLMODE` env var
- Config in [drizzle.config.ts](drizzle.config.ts)

## Testing & Deployment

- No tests currently implemented
- Production uses separate [docker-compose.yaml](docker-compose.yaml)
- Health checks enable zero-downtime deployments
- Database migrations run automatically via Docker service
- All services communicate over internal Docker network
