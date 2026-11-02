// Starts a project-local PostgreSQL (no Docker, no global install) using the
// `embedded-postgres` npm package. Data lives in ./.local-pg (gitignored).
//
//   node scripts/local-db.mjs            # start (Ctrl+C to stop)
//
// The password is random per checkout: it is generated on first run and kept in
// .local-db/credentials.json (gitignored) together with the local NEXTAUTH_SECRET.
// scripts/with-local-env.mjs reads the same file, so `npm run db:local:setup`,
// `dev:server:local` and `dev:web:local` connect without any configuration.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  LOCAL_DB_USER,
  loadLocalCredentials,
  localDatabaseUrl,
  localDbPort,
  root,
} from './local-credentials.mjs';

const databaseDir = path.join(root, '.local-pg');
const port = localDbPort();
const creds = loadLocalCredentials();
const { postgresPassword: password } = creds;

const options = {
  databaseDir,
  user: LOCAL_DB_USER,
  password,
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
};
const pg = new EmbeddedPostgres(options);

const fresh = !existsSync(path.join(databaseDir, 'PG_VERSION'));
if (fresh) {
  console.log(`[local-db] initialising cluster in ${databaseDir}`);
  await pg.initialise();
}
await pg.start();
await rotateLegacyPassword();
await ensureUtf8Database();

// Clusters created before credentials were generated used the old fixed dev
// password (the user name). If the generated password is rejected, log in once
// with that and replace it, so an existing .local-pg keeps its data.
async function rotateLegacyPassword() {
  const probe = pg.getPgClient('postgres');
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (err) {
    if (err?.code !== '28P01') throw err; // 28P01 = invalid_password
  }
  const legacy = clusterAs(LOCAL_DB_USER).getPgClient('postgres');
  try {
    await legacy.connect();
  } catch {
    throw new Error(
      '[local-db] the cluster in .local-pg rejects the password in .local-db/credentials.json. ' +
        'Delete both folders to start over (this drops local data).'
    );
  }
  try {
    const { rows } = await legacy.query('SELECT quote_literal($1) AS lit', [password]);
    await legacy.query(`ALTER ROLE ${LOCAL_DB_USER} PASSWORD ${rows[0].lit}`);
    console.log('[local-db] replaced the old fixed dev password with the generated one');
  } finally {
    await legacy.end();
  }
}

function clusterAs(pw) {
  return new EmbeddedPostgres({ ...options, password: pw });
}

// Older clusters were initialised with the OS code page (WIN1252 on Windows), which
// can't store problem statements. Keep that database as a backup and start a UTF8 one.
async function ensureUtf8Database() {
  const client = pg.getPgClient('postgres');
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = 'codebattle'"
    );
    if (rows.length && rows[0].enc !== 'UTF8') {
      const backup = `codebattle_${rows[0].enc.toLowerCase()}_backup_${Date.now()}`;
      console.log(`[local-db] database uses ${rows[0].enc}; renaming it to ${backup} and creating a UTF8 one`);
      await client.query(`ALTER DATABASE codebattle RENAME TO ${backup}`);
    }
    if (!rows.length || rows[0].enc !== 'UTF8') {
      await client.query("CREATE DATABASE codebattle ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0");
    }
  } finally {
    await client.end();
  }
}
console.log(`[local-db] ready: ${localDatabaseUrl(creds, { mask: true })}`);
console.log('[local-db] credentials: .local-db/credentials.json (scripts/with-local-env.mjs reads them)');

const stop = async () => {
  console.log('[local-db] stopping');
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
// keep the process alive
setInterval(() => {}, 1 << 30);
