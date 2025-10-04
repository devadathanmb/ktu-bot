#!/bin/bash

# Simple bash script to run DB migrations on prod DB
# Source the .env file to load env variables and then run the migration command
# IMPORTANT: Ensure that the .env file has the correct DATABASE_URI and PGSSLMODE variables set
# Usage: ./scripts/migrate-db.sh
set -a
source .env
set +a
pnpm drizzle-kit migrate
