#!/bin/sh
set -e
# docker-compose passes the database as PGHOST/PGUSER/PGPASSWORD/PGDATABASE so the
# password never appears inside a connection string in the compose file.
if [ -z "$DATABASE_URL" ]; then
  DATABASE_URL="$(node /app/scripts/database-url.mjs)"
  export DATABASE_URL
fi
# Apply migrations and (re)seed the question bank before starting. Both are idempotent.
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  npx prisma migrate deploy
  npx tsx prisma/seed.ts
fi
exec "$@"
