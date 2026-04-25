# syntax=docker/dockerfile:1

# Production image - multi-stage build to keep the final image small.
# Only production dependencies and compiled JS are included in the output.

FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

FROM base AS deps

# Install all dependencies (including devDependencies) needed for the build.
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS builder

COPY . .
RUN pnpm build

FROM base AS production

# curl is used by Docker Compose healthchecks.
RUN apk add --no-cache curl

# Install only production dependencies in the final image.
# --ignore-scripts skips the prepare script (runs husky, a devDependency).
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy compiled output and migration assets needed for runtime.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

USER node

EXPOSE 3000

# Run the compiled application directly with Node.js.
CMD ["node", "dist/index.js"]
