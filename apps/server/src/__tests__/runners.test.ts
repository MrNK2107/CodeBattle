import axios, { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CPP_STACK_LIMIT_KB,
  JUDGE0_MAX_STACK_LIMIT_KB,
  cppCompileFlags,
  crashDescription,
  LocalProcessRunner,
  takeSignalMark,
  dockerRunArgs,
  judge0Submission,
  Judge0Runner,
  stackLimitScript,
  withCppStack,
} from '../services/runners';

const cppRequest = { language: 'cpp' as const, source: 'int main() {}', stdin: '', timeLimitMs: 2000 };

describe('C++ stack limit', () => {
  it('defaults to 256 MB, with Judge0 capped at its server maximum', () => {
    expect(CPP_STACK_LIMIT_KB).toBe(262_144);
    expect(JUDGE0_MAX_STACK_LIMIT_KB).toBe(128_000);
  });

  it('is read from CPP_STACK_LIMIT_KB and ignores junk values', async () => {
    vi.resetModules();
    vi.stubEnv('CPP_STACK_LIMIT_KB', '65536');
    vi.stubEnv('JUDGE0_MAX_STACK_LIMIT_KB', 'lots');
    const mod = await import('../services/runners');
    expect(mod.CPP_STACK_LIMIT_KB).toBe(65_536);
    expect(mod.JUDGE0_MAX_STACK_LIMIT_KB).toBe(128_000);
    expect(mod.judge0Submission(cppRequest).stack_limit).toBe(65_536);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('local Linux/macOS: starts the binary through sh after raising ulimit -s', () => {
    const start = withCppStack('/tmp/build/main', 'linux');
    expect(start.cmd).toBe('/bin/sh');
    expect(start.args).toEqual(['-c', stackLimitScript(), '/tmp/build/main']);
    expect(stackLimitScript()).toMatch(/^ulimit -s 262144 /);
    // falls back to the hard limit, then always runs the program
    expect(stackLimitScript()).toContain('ulimit -s "$(ulimit -H -s)"');
    expect(stackLimitScript()).toMatch(/exec "\$0"$/);
    expect(withCppStack('/x/main', 'darwin', 1024).args[1]).toMatch(/^ulimit -s 1024 /);
  });

  it('local Windows: links the stack size into the executable instead', () => {
    expect(withCppStack('C:\b\main.exe', 'win32')).toEqual({ cmd: 'C:\b\main.exe', args: [] });
    expect(cppCompileFlags('win32')).toContain(`-Wl,--stack,${262_144 * 1024}`);
    expect(cppCompileFlags('linux').some(f => f.includes('--stack'))).toBe(false);
    expect(cppCompileFlags('linux')).toEqual(['-O2', '-std=gnu++17', '-pipe', '-w']);
  });

  it('docker: passes --ulimit stack for C++ only', () => {
    const cpp = dockerRunArgs('cpp', 'n', '/env', 'true', {});
    const i = cpp.indexOf('--ulimit');
    expect(i).toBeGreaterThan(-1);
    expect(cpp[i + 1]).toBe(`stack=${262_144 * 1024}:${262_144 * 1024}`);
    // options must come before the image name
    expect(i).toBeLessThan(cpp.indexOf('gcc:13'));
    expect(dockerRunArgs('python', 'n', '/env', 'true', {})).not.toContain('--ulimit');
  });

  it('docker: keeps the sandbox flags', () => {
    const args = dockerRunArgs('cpp', 'name1', '/env', 'echo hi', { DOCKER_RUNTIME: 'runsc' });
    expect(args).toEqual(expect.arrayContaining(['--network', 'none', '--read-only', '--cap-drop', 'ALL', '--runtime', 'runsc']));
    expect(args.slice(-3)).toEqual(['sh', '-c', 'echo hi']);
  });

  it('judge0: sends stack_limit for C++ within the server maximum, not for other languages', () => {
    const body = judge0Submission(cppRequest);
    expect(body.stack_limit).toBe(Math.min(CPP_STACK_LIMIT_KB, JUDGE0_MAX_STACK_LIMIT_KB));
    expect(body.stack_limit).toBe(128_000);
    expect(body.language_id).toBe(54);
    expect(body.compiler_options).toBe('-O2 -std=gnu++17');
    const py = judge0Submission({ ...cppRequest, language: 'python' });
    expect(py).not.toHaveProperty('stack_limit');
    expect(py).not.toHaveProperty('compiler_options');
  });
});

describe('Judge0Runner request', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts the submission with stack_limit and maps the verdict', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { status: { id: 3, description: 'Accepted' }, stdout: Buffer.from('ok\n').toString('base64'), time: '0.01', memory: 3000 },
    });
    const res = await new Judge0Runner('http://judge0.test', undefined).execute(cppRequest);
    expect(res.status).toBe('ok');
    expect(res.stdout).toBe('ok\n');
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0] as [string, Record<string, unknown>, { params: unknown }];
    expect(url).toBe('http://judge0.test/submissions/');
    expect(body.stack_limit).toBe(128_000);
    expect(config.params).toEqual({ base64_encoded: true, wait: true });
  });

  it('a stack overflow (SIGSEGV, status 11) is the player\'s runtime error', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { status: { id: 11, description: 'Runtime Error (NZEC)' }, time: '0.2' } });
    const res = await new Judge0Runner('http://judge0.test', undefined).execute(cppRequest);
    expect(res.status).toBe('runtime_error');
  });
});

describe('crash descriptions', () => {
  it('explains the signals a player program typically dies from', () => {
    expect(crashDescription('SIGSEGV')).toMatch(/stack overflow from too-deep recursion/);
    expect(crashDescription('SIGFPE')).toMatch(/division by zero/);
    expect(crashDescription('SIGABRT')).toMatch(/assertion/);
    expect(crashDescription('SIGKILL')).toMatch(/memory/);
    expect(crashDescription('SIGILL')).toMatch(/without a return/);
    expect(crashDescription('SIGUSR1')).toBe('Killed by SIGUSR1');
  });

  it('accepts signal numbers (docker wrapper, wsl exit codes)', () => {
    expect(crashDescription('11')).toMatch(/^Segmentation fault \(SIGSEGV\)/);
    expect(crashDescription('8')).toMatch(/SIGFPE/);
    expect(crashDescription('42')).toBe('Killed by signal 42');
  });

  it('decodes Windows crash exit codes, and ignores ordinary exits', () => {
    expect(crashDescription(null, 0xc00000fd)).toMatch(/Stack overflow/);
    expect(crashDescription(null, -1073741571)).toMatch(/Stack overflow/); // same code, signed
    expect(crashDescription(null, 0xc0000005)).toMatch(/Access violation/);
    expect(crashDescription(null, 1)).toBeUndefined();
    expect(crashDescription(null, null)).toBeUndefined();
  });

  it('docker: strips the wrapper signal line and keeps the program stderr', () => {
    expect(takeSignalMark('boom\n__CB_SIGNAL__11\n')).toEqual({ stderr: 'boom\n', signal: 'SIGSEGV' });
    expect(takeSignalMark('__CB_SIGNAL__6\n')).toEqual({ stderr: '', signal: 'SIGABRT' });
    expect(takeSignalMark('plain error\n')).toEqual({ stderr: 'plain error\n', signal: null });
    // only a trailing marker counts
    expect(takeSignalMark('__CB_SIGNAL__11\nmore\n').signal).toBeNull();
  });

  it('local runner: a crashed process gets the description in stderr', async () => {
    // Windows: exit with the stack-overflow NTSTATUS; elsewhere: really die from SIGSEGV
    const source =
      process.platform === 'win32'
        ? 'process.stderr.write("partial\\n"); process.exit(-1073741571);'
        : 'process.stderr.write("partial\\n"); process.kill(process.pid, "SIGSEGV");';
    const res = await new LocalProcessRunner().execute({ language: 'javascript', source, stdin: '', timeLimitMs: 5000 });
    expect(res.status).toBe('runtime_error');
    expect(res.stderr.startsWith('partial\n')).toBe(true);
    expect(res.stderr).toMatch(process.platform === 'win32' ? /Stack overflow/ : /SIGSEGV/);
  });

  it('a non-zero exit without a signal adds nothing', async () => {
    const res = await new LocalProcessRunner().execute({ language: 'javascript', source: 'process.exit(3)', stdin: '', timeLimitMs: 5000 });
    expect(res.status).toBe('runtime_error');
    expect(res.stderr).toBe('');
  });

  it('judge0: names the signal from the status description', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { status: { id: 7, description: 'Runtime Error (SIGSEGV)' }, time: '0.2' } });
    const res = await new Judge0Runner('http://judge0.test', undefined).execute(cppRequest);
    expect(res.status).toBe('runtime_error');
    expect(res.stderr).toMatch(/Segmentation fault/);
    vi.restoreAllMocks();
  });
});

describe('Judge0Runner responses', () => {
  afterEach(() => vi.restoreAllMocks());
  const judge0 = () => new Judge0Runner('http://judge0.test', 'secret');
  const reply = (data: Record<string, unknown>) => vi.spyOn(axios, 'post').mockResolvedValue({ data });
  const b64 = (s: string) => Buffer.from(s).toString('base64');

  it('maps time limit, compile error and internal statuses', async () => {
    reply({ status: { id: 5, description: 'Time Limit Exceeded' } });
    expect((await judge0().execute(cppRequest)).status).toBe('time_limit');

    reply({ status: { id: 6, description: 'Compilation Error' }, compile_output: b64('main.cpp:3: error: x') });
    const compile = await judge0().execute(cppRequest);
    expect(compile.status).toBe('compile_error');
    expect(compile.compileOutput).toBe('main.cpp:3: error: x');

    reply({ status: { id: 13, description: 'Internal Error' }, message: b64('isolate failed') });
    const internal = await judge0().execute(cppRequest);
    expect(internal.status).toBe('internal_error');
    expect(internal.stderr).toBe('isolate failed');

    // a response without a status is not trusted as a pass
    reply({});
    expect((await judge0().execute(cppRequest)).status).toBe('internal_error');
  });

  it('uses Judge0 wall time and memory, and an ordinary NZEC exit adds no crash text', async () => {
    reply({ status: { id: 11, description: 'Runtime Error (NZEC)' }, stderr: b64('oops\n'), wall_time: '0.25', time: '0.1', memory: 2048 });
    const res = await judge0().execute(cppRequest);
    expect(res).toMatchObject({ status: 'runtime_error', stderr: 'oops\n', wallMs: 250, memoryKb: 2048 });
  });

  it('sends the API key and bounds the limits', async () => {
    const post = reply({ status: { id: 3, description: 'Accepted' } });
    await judge0().execute({ ...cppRequest, timeLimitMs: 60_000 });
    const [, body, config] = post.mock.calls[0] as [string, Record<string, unknown>, { headers: Record<string, string> }];
    expect(config.headers).toEqual({ 'X-Auth-Token': 'secret', 'X-RapidAPI-Key': 'secret' });
    expect(body.cpu_time_limit).toBe(15);
    expect(body.wall_time_limit).toBe(20);
    expect(judge0Submission({ ...cppRequest, timeLimitMs: 100 }).cpu_time_limit).toBe(1);
  });

  it('a rejected submission is an outage that carries Judge0\'s explanation', async () => {
    const response = { status: 422, data: { stack_limit: ['must be less than or equal to 128000'] } } as unknown as AxiosResponse;
    vi.spyOn(axios, 'post').mockRejectedValue(new AxiosError('Request failed with status code 422', 'ERR_BAD_REQUEST', undefined, undefined, response));
    const res = await judge0().execute(cppRequest);
    expect(res.status).toBe('internal_error');
    expect(res.stderr).toBe('Judge0 request failed: Request failed with status code 422 {"stack_limit":["must be less than or equal to 128000"]}');
  });

  it('a network failure is an outage too', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('connect ECONNREFUSED'));
    const res = await judge0().execute(cppRequest);
    expect(res).toMatchObject({ status: 'internal_error', stderr: 'Judge0 request failed: connect ECONNREFUSED' });
  });
});
