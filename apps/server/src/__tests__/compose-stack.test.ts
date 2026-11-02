import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// docker-compose.yml is the deployment config; these checks keep its C++ stack settings
// consistent with what the server sends Judge0 (a stack_limit above Judge0's MAX_STACK_LIMIT is a 422).
const compose = readFileSync(resolve(__dirname, '../../../../docker-compose.yml'), 'utf8').replace(/\r\n/g, '\n');

/** Text of one top-level service block (2-space indented key up to the next one). */
function service(name: string): string {
  const match = compose.match(new RegExp(String.raw`\n  ${name}:\n([\s\S]*?)(?=\n  [\w-]+:\n|\nvolumes:|$)`));
  if (!match) throw new Error(`service ${name} not found in docker-compose.yml`);
  return match[1];
}

/** `KEY: ${VAR:-default}` in a service's environment, as [VAR, default]. */
function envDefault(block: string, key: string): [string, number] {
  const match = block.match(new RegExp(String.raw`\n\s+${key}: \$\{(\w+):-(\d+)\}`));
  if (!match) throw new Error(`${key} not set from a variable with a default`);
  return [match[1], Number(match[2])];
}

describe('docker-compose C++ stack settings', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('the bundled Judge0 server and worker allow the full 256 MB C++ stack', () => {
    for (const name of ['judge0-server', 'judge0-worker']) {
      const [variable, kb] = envDefault(service(name), 'MAX_STACK_LIMIT');
      expect(variable).toBe('JUDGE0_MAX_STACK_LIMIT_KB');
      expect(kb).toBe(262_144);
    }
  });

  it('the server cap and the Judge0 maximum come from the same variable and default', () => {
    const server = service('server');
    const judge0 = envDefault(service('judge0-server'), 'MAX_STACK_LIMIT');
    expect(envDefault(server, 'JUDGE0_MAX_STACK_LIMIT_KB')).toEqual(judge0);
    expect(envDefault(server, 'CPP_STACK_LIMIT_KB')).toEqual(['CPP_STACK_LIMIT_KB', 262_144]);
  });

  it('with the compose defaults the server sends Judge0 stack_limit 262144 for C++', async () => {
    const server = service('server');
    vi.stubEnv('CPP_STACK_LIMIT_KB', String(envDefault(server, 'CPP_STACK_LIMIT_KB')[1]));
    vi.stubEnv('JUDGE0_MAX_STACK_LIMIT_KB', String(envDefault(server, 'JUDGE0_MAX_STACK_LIMIT_KB')[1]));
    vi.resetModules();
    const { judge0Submission } = await import('../services/runners');
    const body = judge0Submission({ language: 'cpp', source: 'int main() {}', stdin: '', timeLimitMs: 2000 });
    expect(body.stack_limit).toBe(262_144);
    expect(body.stack_limit).toBeLessThanOrEqual(envDefault(service('judge0-server'), 'MAX_STACK_LIMIT')[1]);
  });
});
