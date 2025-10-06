# KTU Bot - AI Coding Agent Instructions

## Architecture Overview

This is a **Grammy-based Telegram bot** (major rewrite from old version) with a **microservices architecture** using Docker Compose. The system consists of:

- **Main Bot Service** (`src/bot/`) - Grammy framework with composers pattern
- **Background Workers** (`src/workers/`) - Independent notification and data sync services using BullMQ
- **Supporting Services** (`src/services/`) - Monitoring and observability tools (Bull Board dashboard)
- **API Services Layer** (`src/api/services/`) - External integrations (KTU, Hugging Face, file hosting)
- **Database Layer** (`src/db/`) - Drizzle ORM with PostgreSQL
- **Configuration System** (`src/configs/`) - Zod-validated environment configs
- **Queue System** (`BullMQ`) - Redis-backed job queuing with automatic retries and scheduling

## Essential Patterns

### Configuration Pattern

All configs use **Zod schemas** for validation and type safety:

```typescript
// Pattern used in src/configs/*.ts
const configSchema = z.object({...}).transform(config => ({...}));
export const Config = configSchema.parse({...});
```

### Service Layer Pattern

API services use **serviceWrapper** for consistent error handling and logging:

```typescript
// Pattern in src/api/services/
import { serviceWrapper } from "../../utils/serviceWrapper.js";
export const serviceName = serviceWrapper("ServiceName", async (params) => {...});
```

### Database Repositories

Follow **Repository pattern** with Drizzle ORM:

Bot features are organized as **composers** (not traditional handlers):

- `src/bot/composers/` - Feature-specific message handling
- Order matters in `src/bot/bot.ts` - inline queries first, then chat-context composers
- Use `sequentialize(getSessionKey)` for long polling to prevent race conditions

### Worker Architecture

Workers extend **BaseWorker** class and use **BullMQ** for job processing:

**Base Worker Pattern** (`src/workers/base/BaseWorker.ts`):

- All workers extend `BaseWorker<TJobData>` abstract class
- Constructor accepts: `workerName`, `queueName`, `queue`, optional `config` (concurrency, limiter)
- Handles common lifecycle: Redis init, DB init, worker creation, event handlers, shutdown
- Workers implement: `processJob()` and `getStatus()`
- Optional hooks: `initializeWorkerSpecific()` (e.g., bot setup), `onStartupComplete()` (e.g., schedule jobs)

**Worker Implementation Pattern**:

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

**Queue Configuration**:

- `DATA_SYNC_QUEUE` - Periodic data synchronization (concurrency: 3, rate limited)
- `ANNOUNCEMENTS_NOTIFY_QUEUE` - New announcement notifications (concurrency: 1)
- `BROADCASTS_QUEUE` - Message broadcasting to users (concurrency: 1)

**Shared Utilities**:

- `src/workers/shared/utils/attachmentProcessor.ts` - File upload/processing utilities
- `src/workers/shared/redis.ts` - Redis connection configs for queues/workers
- `src/workers/shared/queueHealth.ts` - Queue health check utility
- `src/workers/shared/shutdown.ts` - Graceful shutdown handler

### Database Repositories

Follow **Repository pattern** with Drizzle ORM:

- Repository classes in `src/db/repositories/`
- Schema definitions in `src/db/schema/`
- Use transactions for complex operations via `src/db/transactions.ts`

## Development Workflows

### Local Development

```bash
# Start all services with hot reload
docker-compose -f docker-compose.dev.yaml down -v --remove-orphans && docker-compose -f docker-compose.dev.yaml up --build

# Start only bot service
docker-compose -f docker-compose.dev.yaml up ktu-bot-app --build

# Database operations
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Apply migrations
pnpm db:studio    # Open Drizzle Studio
```

### Worker Development

Workers extend **BaseWorker** abstract class:

**Structure**:

- `src/workers/base/BaseWorker.ts` - Abstract base class with common lifecycle
- `src/workers/announcements/notify/` - Announcement notification worker
- `src/workers/broadcasts/` - Broadcast delivery worker
- `src/workers/data-sync/` - Data synchronization worker

**Worker Responsibilities**:

- Extend `BaseWorker<TJobData>` and pass config to constructor
- Implement `processJob(job)` - core business logic
- Implement `getStatus()` - health check endpoint
- Optionally override `initializeWorkerSpecific()` - setup bot, services
- Optionally override `onStartupComplete()` - schedule initial/recurring jobs

**BaseWorker handles**:

- Redis and database initialization
- BullMQ worker creation with concurrency/rate limiting
- Job processing with error handling wrapper
- Event handlers (completed, failed)
- Graceful shutdown

**Startup files**: Each worker has a startup file that creates worker instance, sets up health check, and registers graceful shutdown

## Critical Integration Points

### Session Management

- **Memory-based sessions** with TTL (`BotConfig.BOT_SESSION_DATA_TTL`)
- Session key: `ctx.chat.id.toString()`
- Session data structure defined in `src/types/bot.types.ts`

### File Handling

- Temporary files via `src/utils/fileUtils.ts`
- File uploads to external service via `src/api/services/file/`
- Bot file channel: `BOT_FILE_UPLOAD_CHANNEL_ID` (negative number)

### Error Handling

- Global bot error handler in `src/bot/handlers/globalError.ts`
- Service-level error wrapping via `serviceWrapper`
- Structured logging with custom logger (`src/utils/logger.ts`)

### Health Checks

Each service exposes health endpoints:

- Bot: port 3000
- Workers: ports 3001, 3002, 3003
- Health check utility in `src/utils/healthCheck.ts`

### Queue Monitoring

**Bull Board** provides a unified dashboard for monitoring all BullMQ queues:

- Standalone service running on port 3010
- Access at `http://localhost:3010`
- **Unified view** of all queues (DATA_SYNC_QUEUE, ANNOUNCEMENTS_NOTIFY_QUEUE, BROADCASTS_QUEUE)
- Real-time monitoring of job states: waiting, active, completed, failed, delayed
- Job retry and management capabilities
- Queue registry in `src/workers/shared/queueRegistry.ts`
- Service implementation in `src/services/bull-board/`

**Architecture Benefits:**

- Separation of concerns - monitoring is independent of workers
- No cross-worker dependencies
- Can run/skip monitoring service independently
- Workers remain focused on job processing

## Environment Configuration

Environment files in `dev/` directory (not gitignored for dev convenience):

- `bot.env` - Core bot configuration
- `db.env` - Database connection
- `redis.env` - Redis configuration
- `*-worker.env` - Worker-specific configs

## Key Conventions

- **ES Modules**: Use `.js` extensions in imports even for TypeScript files
- **Grammy Middleware Order**: Sequence matters, inline queries first
- **Zod Validation**: All external data and configs must be validated
- **Repository Pattern**: Database operations through dedicated repository classes
- **BullMQ Jobs**: Use queues for scheduled/background work instead of direct cron
- **Graceful Shutdown**: All services implement proper shutdown handling
- **Auto-retry**: Bot API calls use `@grammyjs/auto-retry`, workers use BullMQ retry

## Deprecated Features

- Old result checking commands are deprecated (see `src/constants/bot.ts`)
- Handle via `deprecatedCommandHandler` in `src/bot/handlers/deprecated.ts`

## Testing & Deployment

- No tests currently implemented
- Production uses separate `docker-compose.yaml`
- Health checks enable zero-downtime deployments
- TypeScript compilation via `pnpm build`
