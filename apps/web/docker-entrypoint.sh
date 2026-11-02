#!/bin/sh
set -e
# docker-compose passes the database as PGHOST/PGUSER/PGPASSWORD/PGDATABASE so the
# password never appears inside a connection string in the compose file.
if [ -z "$DATABASE_URL" ]; then
  DATABASE_URL="$(node /app/scripts/database-url.mjs)"
  export DATABASE_URL
fi
exec "$@"
