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

Workers use **BullMQ** for job processing and scheduling:

- **Queue Pattern**: Each worker has a dedicated queue with retry configuration
- **Scheduling**: BullMQ repeatable jobs replace node-cron for periodic tasks
- **Retry Strategy**: Exponential backoff with configurable attempts (default: 3)
- **Concurrency**: Configurable parallel job processing
- **Health Checks**: Monitor queue state (waiting, active, failed jobs)

Worker queues:

- `DATA_SYNC_QUEUE` - Periodic data synchronization (announcements, calendars, timetables)
- `ANNOUNCEMENTS_NOTIFY_QUEUE` - New announcement notifications
- `BROADCASTS_QUEUE` - Message broadcasting to users

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

Workers are **BullMQ-based services** with separate startup files:

- `src/workers/announcements/notify/startup.ts` - Announcement notification worker
- `src/workers/broadcasts/startup.ts` - Broadcast delivery worker
- `src/workers/data-sync/startup.ts` - Data synchronization worker

Each worker:

- Uses BullMQ for job scheduling and processing
- Implements automatic retry with exponential backoff
- Provides queue health monitoring
- Supports graceful shutdown

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
