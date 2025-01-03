# FROM node:18-slim
# WORKDIR /bot
# COPY package.json /bot
# COPY package-lock.json /bot
# RUN npm ci
# COPY . /bot
# RUN npm run build
# CMD ["npm", "run", "start"]
#

# Stage 1: Build Stage
FROM node:18-slim AS builder

# Set working directory
WORKDIR /bot

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the code (after installing dependencies to leverage cache)
COPY . ./

# Run build
RUN npm run build

# Stage 2: Production Stage
FROM node:18-slim

# Set working directory
WORKDIR /bot

# Copy only the necessary files from the build stage
COPY --from=builder /bot /bot

# Install only runtime dependencies (remove dev dependencies)
RUN npm prune --production

# Set the command to start the app
CMD ["npm", "run", "start"]
