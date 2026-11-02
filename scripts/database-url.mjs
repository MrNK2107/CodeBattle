// Prints a DATABASE_URL built from the standard libpq variables
// (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE). The container entrypoints use
// it so docker-compose never has to spell a connection string with the password
// inline; the password is URL-encoded, so any characters are safe.
//
//   DATABASE_URL="$(node scripts/database-url.mjs)"
const missing = ['PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].filter(name => !process.env[name]);
if (missing.length) {
  console.error(`database-url: set DATABASE_URL, or all of ${missing.join(', ')}`);
  process.exit(1);
}
const url = new URL(`postgresql://${process.env.PGHOST}:${process.env.PGPORT || 5432}`);
url.pathname = `/${encodeURIComponent(process.env.PGDATABASE)}`;
url.username = process.env.PGUSER;
url.password = process.env.PGPASSWORD;
process.stdout.write(url.toString());
