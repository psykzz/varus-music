#!/bin/sh
set -e

echo "Applying database schema..."
npx prisma db push --skip-generate

echo "Generating Prisma client..."
npx prisma generate

echo "Starting backend server..."
exec node src/index.js
