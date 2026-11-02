// Runs a command with the "no-infra" local dev environment:
//   - Postgres from scripts/local-db.mjs (port 54329)
//   - in-memory Redis + submission queue (REDIS_URL=memory)
//   - local JS/Python code runner instead of Judge0 (CODE_RUNNER=local)
//   - a NEXTAUTH_SECRET shared by web + server
//
// The database password and NEXTAUTH_SECRET come from .local-db/credentials.json,
// which is generated with random values on first use (see scripts/local-credentials.mjs).
//
//   node scripts/with-local-env.mjs <command...>
//
// Values here override .env so the local stack is always self-consistent.
import { spawn } from 'node:child_process';
import { loadLocalCredentials, localDatabaseUrl } from './local-credentials.mjs';

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('usage: node scripts/with-local-env.mjs <command...>');
  process.exit(1);
}

const creds = loadLocalCredentials();
const { nextAuthSecret: secret } = creds;
const localEnv = {
  DATABASE_URL: localDatabaseUrl(creds),
  REDIS_URL: process.env.REDIS_URL ?? 'memory',
  CODE_RUNNER: process.env.CODE_RUNNER ?? 'local',
  NEXTAUTH_SECRET: secret,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000',
  DEV_LOGIN: '1',
};

// shell: true on every platform. The commands come from our own package.json
// scripts and several are compound ("prisma migrate deploy && tsx ..."), which
// only a shell can run; without it spawn() fails with ENOENT on Linux/macOS.
const child = spawn([cmd, ...args].join(' '), {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ...localEnv },
});
child.on('error', err => {
  console.error(`[with-local-env] failed to start "${cmd}": ${err.message}`);
  process.exit(1);
});
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
