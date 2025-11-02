# Production Dockerfile for KTU Bot
FROM node:20-alpine

# Setup pnpm environment as per pnpm Docker docs
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install curl for healthchecks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (tsx needs dev deps)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN pnpm build

# Expose port
EXPOSE 3000

# Run with tsx directly
CMD ["pnpm", "start"]