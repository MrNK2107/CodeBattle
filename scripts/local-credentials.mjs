// Credentials for the "no-infra" local dev stack (scripts/local-db.mjs +
// scripts/with-local-env.mjs).
//
// Nothing is hard-coded: on first use a random Postgres password and a random
// NEXTAUTH_SECRET are generated and written to .local-db/credentials.json
// (gitignored, mode 0600 where the OS supports it). Later runs read them back,
// so the database, the web app and the battle server always agree.
//
// Delete .local-db/ together with .local-pg/ to start over with a fresh cluster.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const credentialsDir = path.join(root, '.local-db');
export const credentialsFile = path.join(credentialsDir, 'credentials.json');

export const LOCAL_DB_USER = 'codebattle';
export const LOCAL_DB_NAME = 'codebattle';

export function localDbPort() {
  return Number(process.env.LOCAL_PG_PORT ?? 54329);
}

function generate() {
  return {
    // hex keeps the password URL-safe
    postgresPassword: randomBytes(24).toString('hex'),
    nextAuthSecret: randomBytes(32).toString('base64'),
    createdAt: new Date().toISOString(),
  };
}

/** Reads .local-db/credentials.json, creating it with fresh random values if it is missing. */
export function loadLocalCredentials() {
  if (existsSync(credentialsFile)) {
    const parsed = JSON.parse(readFileSync(credentialsFile, 'utf8'));
    if (parsed.postgresPassword && parsed.nextAuthSecret) return parsed;
    throw new Error(`${credentialsFile} is incomplete; delete .local-db/ and .local-pg/ to start over`);
  }
  const creds = generate();
  mkdirSync(credentialsDir, { recursive: true });
  writeFileSync(credentialsFile, JSON.stringify(creds, null, 2) + '\n', { mode: 0o600 });
  console.log(`[local-db] generated local credentials in ${path.relative(root, credentialsFile)}`);
  return creds;
}

/** postgresql:// URL for the local cluster; pass { mask: true } for anything that gets printed. */
export function localDatabaseUrl(creds, { mask = false } = {}) {
  const url = new URL(`postgresql://localhost:${localDbPort()}/${LOCAL_DB_NAME}`);
  url.username = LOCAL_DB_USER;
  url.password = mask ? '*****' : creds.postgresPassword;
  return url.toString();
}
