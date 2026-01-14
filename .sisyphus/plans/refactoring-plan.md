# Refactoring Work Plan

## Overview

Two independent refactoring tasks:

1. **Folder Rename**: Convert camelCase directories to kebab-case
2. **Bot Factory Refactor**: Split `createBot` into two functions with shared common setup

---

## Task 1: CamelCase → Kebab-case Folder Rename

### Folders to Rename

| #   | Current Path                                  | New Path                                       |
| --- | --------------------------------------------- | ---------------------------------------------- |
| 1   | `src/bot/composers/announcementSubscriptions` | `src/bot/composers/announcement-subscriptions` |
| 2   | `src/bot/composers/inlineQuery`               | `src/bot/composers/inline-query`               |

### Files Requiring Import Updates (11 files)

| File                                                        | Imports to Update                                  |
| ----------------------------------------------------------- | -------------------------------------------------- |
| `src/bot/bot.ts`                                            | `announcementSubscriptions`, `inlineQuery`         |
| `src/bot/commands/index.ts`                                 | `announcementSubscriptions`                        |
| `src/bot/handlers/chatMemeber.ts`                           | `announcementSubscriptions`                        |
| `src/bot/composers/core/commands/help.ts`                   | `announcementSubscriptions`                        |
| `src/bot/composers/core/commands/search.ts`                 | `inlineQuery`                                      |
| `src/db/schema/index.ts`                                    | `announcementSubscriptions.js`                     |
| `src/db/schema/announcementSubscriptions.ts`                | **Rename file to `announcement-subscriptions.ts`** |
| `src/db/repositories/AnnouncementSubscriptionRepository.ts` | `../schema/announcementSubscriptions`              |
| `src/constants/bot.ts`                                      | `announcementSubscriptions`                        |
| `src/bot/composers/announcement-subscriptions/composer.ts`  | **Internal self-reference if any**                 |
| `src/bot/composers/inline-query/composer.ts`                | **Internal self-reference if any**                 |

### Execution Order

1. Rename directories via bash (preserves git history)
2. Rename schema file `announcementSubscriptions.ts` → `announcement-subscriptions.ts`
3. Update all imports in affected files
4. Run `pnpm lint:fix` and verify with `lsp_diagnostics`
5. Build: `pnpm build`
6. Test: `docker compose -f docker/compose.dev.yaml up ktu-bot-app --build`

---

## Task 2: Bot Factory Refactor

### Current Code (`src/bot/bot.ts`)

```typescript
export function createBot(metrics?: BotMetrics): Bot<BotContext> {
  const bot = new Bot<BotContext>(BotConfig.BOT_TOKEN);

  if (metrics) {
    bot.use(createMetricsMiddleware(metrics));
  }

  bot.use(logging);
  // ... 70+ lines of common setup
  bot.catch(error => globalErrorHandler(error, metrics));

  return bot;
}
```

### Problems

1. SRP violation - single function handles two use cases
2. Callers must know whether to pass metrics
3. No clear distinction between "metrics" and "no-metrics" code paths

### Proposed Design (DRY - No Duplication)

```typescript
// src/bot/bot.ts

/**
 * Creates a bot without metrics instrumentation.
 * Use this for background workers that don't need observability.
 */
export function createBot(): Bot<BotContext> {
  return createBotWithMetrics(undefined);
}

/**
 * Creates a bot with optional metrics instrumentation.
 * Use this for the main bot application to enable Prometheus metrics.
 */
export function createBotWithMetrics(metrics?: BotMetrics): Bot<BotContext> {
  const bot = new Bot<BotContext>(BotConfig.BOT_TOKEN);

  // Metrics middleware - only if metrics provided
  if (metrics) {
    bot.use(createMetricsMiddleware(metrics));
  }

  return configureBot(bot, metrics);
}

/**
 * Internal: Configures common bot middleware and handlers.
 * All bot instances (with or without metrics) go through this.
 */
function configureBot(
  bot: Bot<BotContext>,
  metrics?: BotMetrics
): Bot<BotContext> {
  // Logging should be the first middleware in the stack
  bot.use(logging);

  // Long polling only middlewares
  if (BotConfig.IS_LONG_POLLING_DEPLOYMENT) {
    bot.use(sequentialize(getSessionKey));
  }

  bot.use(
    session({
      initial: initSession,
      storage: enhanceStorage({
        storage: new MemorySessionStorage<Enhance<SessionData>>(),
        millisecondsToLive: BotConfig.BOT_SESSION_DATA_TTL,
      }),
    })
  );
  bot.use(trackChatId);
  bot.use(hydrate());
  bot.use(emojiParser());
  bot.use(commands());

  // Handle inline queries first
  bot.use(inlineQuery);

  bot.on("my_chat_member", chatMemeberHandler);

  // Deprecated features
  bot.command(DEPRECATED_COMMANDS_LIST, deprecatedCommandHandler);

  // Composer middlewares
  bot.use(announcementSubscriptions);
  bot.use(announcementsLookup);
  bot.use(timetableLookup);
  bot.use(calendarLookup);

  // Command group middleware
  bot.use(botCommands);

  // Handle unknown commands
  bot.filter(commandNotFound(botCommands)).use(unknownCommandHandler);

  // Unhandled stuff
  bot.use(unhandled);

  // Global error handler with optional metrics
  bot.catch(error => globalErrorHandler(error, metrics));

  return bot;
}
```

### Callers to Update

| File                                         | Current Call            | New Call                              |
| -------------------------------------------- | ----------------------- | ------------------------------------- |
| `src/index.ts`                               | `createBot(botMetrics)` | `createBotWithMetrics(botMetrics)` ✅ |
| `src/workers/announcements/notify/worker.ts` | `createBot()`           | No change needed                      |
| `src/workers/broadcasts/worker.ts`           | `createBot()`           | No change needed                      |
| `src/workers/data-sync/worker.ts`            | `createBot()`           | No change needed                      |
| `src/workers/attachment-delivery/worker.ts`  | `createBot()`           | No change needed                      |
| `src/bot/utils/createWorkerBot.ts`           | `createBot()`           | No change needed                      |

### Verification Steps

1. Update `src/bot/bot.ts` with new structure
2. Update `src/index.ts` to use `createBotWithMetrics`
3. Run `lsp_diagnostics` on both files
4. Build: `pnpm build`
5. Test: `docker compose -f docker/compose.dev.yaml up ktu-bot-app --build`

---

## Execution Order

**Recommended: Task 2 first, then Task 1**

1. **Task 2 (Bot Factory)**: Smaller scope, fewer files, lower risk
2. **Task 1 (Folder Rename)**: More files, affects schema imports, higher risk

---

## Risk Assessment

| Task                 | Risk Level | Reason                                          |
| -------------------- | ---------- | ----------------------------------------------- |
| Bot Factory Refactor | **Low**    | Only 2 files to modify, clear before/after      |
| Folder Rename        | **Medium** | 11+ files, affects DB schema imports (critical) |

---

## Rollback Plan

If issues arise:

```bash
# Task 1 (Folder Rename)
git restore --source=HEAD src/bot/composers/{announcementSubscriptions,inlineQuery}
git restore --source=HEAD src/db/schema/{announcementSubscriptions.ts,announcement-subscriptions.ts}
git checkout HEAD -- .

# Task 2 (Bot Factory)
git restore src/bot/bot.ts src/index.ts
```
