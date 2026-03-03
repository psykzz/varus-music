#!/bin/sh
set -e

echo "Initialising database (if needed)..."
psql "$DATABASE_URL" -f /app/prisma/init.sql

echo "Generating Prisma client..."
npx prisma generate

echo "Starting backend server..."
exec node src/index.js
