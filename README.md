<h1 align="center">KTU Bot</h1>

<p align="center">
 <img align="center" width="180" src="assets/bot-profile-pic.jpg" alt="KTU Bot" />
</p>

<p align="center">
<strong>A battle-tested, fully open source & libre Telegram bot that served 30,000+ users/month at its peak</strong><br/>
Fast lookups • Full-text search • Smart announcement subscriptions • Real-time notifications<br/>
Everything the official website should've been, but isn't.
</p>

<p align="center"><em>No ads. No tracking. 100% libre and will always remain so.</em></p>

<p align="center">
 <a href="https://ktu-bot-status.betteruptime.com/">
 <img src="https://uptime.betterstack.com/status-badges/v1/monitor/28gdv.svg" alt="Better Stack Badge" />
 </a>
</p>

---

> [!IMPORTANT]
> This bot just got a **major rewrite**. This branch (`grammy-rewrite`) contains the new architecture built on [GrammY](https://grammy.dev/). The legacy implementation lives in the `prod` branch.
>
> **Read the story:** [Why I rewrote this entire thing](./docs/rewrite.md)

> [!NOTE]
> This project is currently in **autopilot/maintenance mode**. Core functionality depends on public KTU endpoints that can change without notice. If you want to help maintain, extend, or fork it, you're more than welcome.

---

## What Is This?

KTU Bot is a Telegram bot that helps students do everything they could (and should) do on the official KTU website: check announcements, timetables, academic calendars, results, and more. The official site is notoriously clunky and frequently crashes when you actually need it, so this bot **taps into their public APIs** to deliver a reliable experience the website can't.

What started as a quick 50-line script to check my own results eventually became a lifeline for tens of thousands of students. It turned into the default go-to during results season, sparked a wave of similar tools, and carved out its own identity.

### What You Can Do

- **Full-text search** across announcements, academic calendars, and exam timetables. Find what you need right from the chat
- **Browse historical data:** announcements, exam timetables, academic calendars, and syllabi, all in one place
- **Smart subscriptions:** get only the announcements that matter to you using filters (course, type), delivered the moment they arrive
- **Results lookup** _(currently broken, not the bot's fault, [read why](./docs/rewrite.md#results-not-working))_

> [!TIP]
> Check out the [Commonly Asked Questions](./docs/rewrite.md#commonly-asked-questions) for answers to common questions like "Why isn't results working?" and "Will the bot keep working?"

## Architecture Overview

The bot is built as independent services: the main bot, background workers for notifications and data syncing, and supporting databases. If one worker crashes, the bot keeps running.

| Component                       | Type                | What It Does                                                                                  |
| ------------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| **Bot**                         | GrammY Telegram bot | Handles all user interactions: commands, searches, conversations                              |
| **Announcements Notify Worker** | Background worker   | Monitors for new announcements using BullMQ scheduled jobs and sends filtered alerts to users |
| **Broadcasts Worker**           | Background worker   | Handles queued broadcast message delivery                                                     |
| **Data Sync Worker**            | Background worker   | Periodically syncs KTU data to local DB via BullMQ scheduled jobs to power full-text search   |
| **Attachment Delivery Worker**  | Background worker   | Downloads and sends files asynchronously to prevent bot blocking                              |
| **Bull Board Service**          | Monitoring service  | Web dashboard for real-time queue monitoring and job management                               |
| **PostgreSQL**                  | Database            | Stores all data with Drizzle ORM for type-safe queries                                        |
| **Redis**                       | Queue               | Powers BullMQ jobs                                                                            |

> [!TIP]
> **Want to understand how it all works?** Check out [How It Works](./docs/working.md) for the complete architecture breakdown with diagrams.

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js](https://nodejs.org/) (if running locally); this project uses `pnpm`
- A Telegram bot token from [@BotFather](https://t.me/botfather)

Docker is the recommended way to run the stack.

### 1. Clone the Repo

```bash
git clone https://github.com/devadathanmb/ktu-bot.git
cd ktu-bot
```

### 2. Configure Environment

Development defaults live in `env/dev/*.env` (one file per service or shared module, tracked in git). Each file comes with working defaults; fill in the secrets for the features you use.

**Minimum required:**

- `env/dev/bot.env`: set `BOT_TOKEN` and `BOT_FILE_UPLOAD_CHANNEL_ID`

**Optional (for extra features):**

- `env/dev/api.env`: uptime monitoring keys (UptimeRobot, Better Uptime)
- `env/dev/llm.env`: Groq API key for AI-powered announcement filtering

> [!NOTE]
> `env/dev/*.env` files are pre-configured with working defaults. Placeholders like API keys are left blank; fill in only the ones for features you need.

> [!IMPORTANT]
> **For local secrets:**
>
> ```bash
> cp env/dev/.env.example env/dev/.env
> # Add your personal API keys, tokens, or credentials here
> ```
>
> This file is mounted **last** in Docker Compose, so values here override anything in `env/dev/*.env` files. It is gitignored. Never commit it.

> [!WARNING]
> Missing required variables fail fast at startup via config validation. If a service refuses to start, check its `.env` file first.

### 3. Run Everything

```bash
docker compose -f docker/compose/compose.dev.yaml up --build
```

This starts all services with hot-reload enabled. Code changes trigger automatic restarts.

### 4. Run Only the Bot

If you don't need the workers:

```bash
docker compose -f docker/compose/compose.dev.yaml up ktu-bot-app --build
```

> [!TIP]
> Database migrations are generated and run automatically via the `ktu-bot-db-migrations` service.
>
> Once everything is up, talk to your bot in Telegram!

### 5. Run Individual Workers

Need just the notification worker? No problem:

```bash
# Announcements notify worker
docker compose -f docker/compose/compose.dev.yaml up announcements-notify-worker --build

# Data sync worker
docker compose -f docker/compose/compose.dev.yaml up data-sync-worker --build

# Broadcasts worker
docker compose -f docker/compose/compose.dev.yaml up broadcasts-worker --build

# Attachment delivery worker
docker compose -f docker/compose/compose.dev.yaml up attachment-delivery-worker --build
```

> [!TIP]
> Each service exposes a health check endpoint (e.g., `http://localhost:3000/health`)
>
> There's also a dedicated `bull-board-service` running on port `3010` that provides a Bull Board UI for monitoring background workers and queues. Access it at `http://localhost:3010`

## Production Deployment

Production config is a gitignored `.env` at `env/prod/.env` (created from the tracked template below), plus a small `env/prod/attachment-delivery-worker.env` for that worker's port.

### 1. Configure Environment

```bash
cp env/prod/.env.example env/prod/.env
# Edit env/prod/.env and fill in all blank values
```

Ports and schedules come prefilled (notify every 2 minutes, data sync every 30); the remaining blanks are deployment-specific values: secrets, hosts, timeouts, and logging.

### 2. Start Monitoring (Optional but Recommended)

```bash
# Start Prometheus monitoring independently
docker compose -f docker/monitoring/compose.yaml up -d
```

This starts Prometheus on port 9090 with persistent storage. It runs independently from the application stack.

### 3. Start Application Services

```bash
docker compose -f docker/compose/compose.yaml up -d --build
```

### 4. Verify Health

```bash
curl -f http://localhost:3000/health
```

### Notes

- All services communicate over an internal Docker network
- Database migrations run automatically on startup
- `env/prod/.env` is gitignored. Create it from `env/prod/.env.example` on the deploy host (see `env/dev/*.env` for per-service defaults)
- Missing required variables fail startup validation, so verify the `.env` before deploying

## Tech Stack

- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Bot Framework:** [GrammY](https://grammy.dev/), type-safe Telegram bot framework
- **Database:** [PostgreSQL](https://www.postgresql.org/) with full-text search
- **ORM:** [Drizzle](https://orm.drizzle.team/), type-safe SQL queries and migrations
- **Job Queue:** [BullMQ](https://docs.bullmq.io/) with Redis, background job processing
- **HTTP Client:** [got](https://github.com/sindresorhus/got) with in-memory caching

## Contributing

Contributions are welcome, whether bug fixes, new features, docs, or ideas.

Found a bug? Have an idea? [Open an issue](https://github.com/devadathanmb/ktu-bot/issues). When reporting bugs, please include:

- What you were trying to do?
- What happened instead?
- Steps to reproduce (if reproducible)

> [!TIP]
> **Need help getting started?** Check out [How It Works](./docs/working.md) to understand the architecture.

> [!TIP]
> **New to Telegram Bot ecosystem?** Check out this [awesome getting started guide](https://grammy.dev/guide/getting-started) from GrammY.

---

## Documentation

- **[How It Works](./docs/working.md)**: Complete architecture breakdown with diagrams
- **[The Rewrite Story](./docs/rewrite.md)**: Why I rewrote this and some commonly asked questions

## License

**AGPL-3.0**: See [LICENSE](./LICENSE.md) for details.
