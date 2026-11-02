import axios from 'axios';
import { spawn } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import type { Language } from '@codebattle/shared';

export interface ExecutionRequest {
  language: Language;
  source: string;
  stdin: string;
  /** wall-clock budget for the whole program run (compilation excluded) */
  timeLimitMs: number;
}

export type ExecutionStatus = 'ok' | 'compile_error' | 'runtime_error' | 'time_limit' | 'internal_error';

export interface ExecutionResult {
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  compileOutput?: string;
  wallMs: number;
  memoryKb?: number;
}

/** Anything that can compile and run a program: stdin in, stdout out. */
export interface CodeRunner {
  readonly name: string;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

const OUTPUT_LIMIT = 2_000_000;

// ---------------------------------------------------------------- local

/**
 * Runs programs as local child processes (python / node / javac+java / g++).
 *
 * NOT A SANDBOX: code runs with the server's permissions. For local development
 * only; the server refuses to use it in production unless explicitly allowed.
 */
export class LocalProcessRunner implements CodeRunner {
  readonly name = 'local';
  private readonly javaBuilds = new Map<string, Promise<Build>>();
  private readonly cppBuilds = new Map<string, Promise<Build>>();

  constructor(
    private readonly pythonBin: string = process.env.PYTHON_BIN ?? (process.platform === 'win32' ? 'python' : 'python3'),
    private readonly javaBin: string = process.env.JAVA_BIN ?? 'java',
    private readonly javacBin: string = process.env.JAVAC_BIN ?? 'javac',
    private readonly cxxBin: string = process.env.CXX_BIN ?? 'g++'
  ) {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    if (request.language === 'java') return this.executeJava(request);
    if (request.language === 'cpp') return this.executeCpp(request);

    const dir = await mkdtemp(path.join(os.tmpdir(), 'codebattle-run-'));
    const file = path.join(dir, request.language === 'python' ? 'main.py' : 'main.js');
    try {
      await writeFile(file, request.source, 'utf8');
      const cmd = request.language === 'python' ? this.pythonBin : process.execPath;
      const env = request.language === 'python' ? { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' } : process.env;
      const run = await runProcess(cmd, [file], request.stdin, request.timeLimitMs, dir, env);
      return toResult(run);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async executeJava(request: ExecutionRequest): Promise<ExecutionResult> {
    const build = await this.compileJava(request.source);
    if (build.unavailable) return { status: 'internal_error', stdout: '', stderr: build.error ?? '', wallMs: 0 };
    if (build.error !== undefined) {
      return { status: 'compile_error', stdout: '', stderr: '', compileOutput: build.error, wallMs: 0 };
    }
    const run = await runProcess(
      this.javaBin,
      ['-Xmx512m', '-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', '-Dfile.encoding=UTF-8', '-cp', build.dir, 'Main'],
      request.stdin,
      request.timeLimitMs + 1500,
      build.dir
    );
    return toResult(run);
  }

  private async executeCpp(request: ExecutionRequest): Promise<ExecutionResult> {
    const build = await this.compileCpp(request.source);
    if (build.unavailable) return { status: 'internal_error', stdout: '', stderr: build.error ?? '', wallMs: 0 };
    if (build.error !== undefined) {
      return { status: 'compile_error', stdout: '', stderr: '', compileOutput: build.error, wallMs: 0 };
    }
    const { cmd, args } = withCppStack(path.join(build.dir, CPP_BINARY));
    const run = await runProcess(cmd, args, request.stdin, request.timeLimitMs, build.dir);
    return toResult(run);
  }

  /** Builds are cached per source so a run and a submit of the same code compile once. */
  private compileJava(source: string): Promise<Build> {
    return compileCached(this.javaBuilds, 'codebattle-java', source, 'Main.java', 'Main.class', dir =>
      runProcess(this.javacBin, ['-encoding', 'UTF-8', '-nowarn', '-d', dir, path.join(dir, 'Main.java')], '', 30_000, dir)
    );
  }

  private compileCpp(source: string): Promise<Build> {
    return compileCached(this.cppBuilds, 'codebattle-cpp', source, 'main.cpp', CPP_BINARY, dir =>
      runProcess(this.cxxBin, [...cppCompileFlags(), '-o', path.join(dir, CPP_BINARY), path.join(dir, 'main.cpp')], '', 60_000, dir)
    );
  }
}

const CPP_BINARY = process.platform === 'win32' ? 'main.exe' : 'main';
/** gnu++17 so player code may use C++17 (the harness itself only needs C++14). */
export const CPP_FLAGS = ['-O2', '-std=gnu++17', '-pipe', '-w'];

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Stack size for C++ programs, in KB (default 256 MB, `CPP_STACK_LIMIT_KB`).
 *
 * The OS default (8 MB on Linux, 1 MB on Windows) overflows on a recursive DFS a few
 * hundred thousand frames deep, which LeetCode-style problems expect to work; the
 * program then dies with SIGSEGV and the player sees a runtime error. Each runner
 * raises it its own way:
 * - local, Linux/macOS: `ulimit -s` in a `sh` wrapper (falls back to the hard limit)
 * - local, Windows (MinGW): linked into the executable with `-Wl,--stack`
 * - docker: `--ulimit stack=` (the stack still counts against the 384 MB memory cap)
 * - judge0: `stack_limit`, capped at `JUDGE0_MAX_STACK_LIMIT_KB` (Judge0's own
 *   MAX_STACK_LIMIT, 128000 by default; Judge0 rejects larger values)
 */
export const CPP_STACK_LIMIT_KB = positiveInt(process.env.CPP_STACK_LIMIT_KB, 262_144);
export const JUDGE0_MAX_STACK_LIMIT_KB = positiveInt(process.env.JUDGE0_MAX_STACK_LIMIT_KB, 128_000);

/** g++ flags for a build on `platform`. On Windows the stack size is a link-time setting. */
export function cppCompileFlags(platform: NodeJS.Platform = process.platform, stackKb: number = CPP_STACK_LIMIT_KB): string[] {
  return platform === 'win32' ? [...CPP_FLAGS, `-Wl,--stack,${stackKb * 1024}`] : [...CPP_FLAGS];
}

/** POSIX sh snippet that raises the soft stack limit (or as far as the hard limit allows), then execs "$0". */
export function stackLimitScript(stackKb: number = CPP_STACK_LIMIT_KB): string {
  return `ulimit -s ${stackKb} 2>/dev/null || ulimit -s "$(ulimit -H -s)" 2>/dev/null; exec "$0"`;
}

/** How to start a compiled C++ binary so it gets the larger stack. */
export function withCppStack(
  binary: string,
  platform: NodeJS.Platform = process.platform,
  stackKb: number = CPP_STACK_LIMIT_KB
): { cmd: string; args: string[] } {
  // Windows reads the stack size from the executable header (see cppCompileFlags)
  if (platform === 'win32') return { cmd: binary, args: [] };
  return { cmd: '/bin/sh', args: ['-c', stackLimitScript(stackKb), binary] };
}

interface Build {
  dir: string;
  error?: string;
  /** the compiler could not be run at all */
  unavailable?: boolean;
}

function compileCached(
  cache: Map<string, Promise<Build>>,
  folder: string,
  source: string,
  sourceFile: string,
  output: string,
  compile: (dir: string) => Promise<ProcessResult>
): Promise<Build> {
  const key = createHash('sha256').update(source).digest('hex');
  let build = cache.get(key);
  if (!build) {
    build = (async () => {
      const dir = path.join(os.tmpdir(), folder, key.slice(0, 24));
      if (existsSync(path.join(dir, output))) return { dir };
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, sourceFile), source, 'utf8');
      const res = await compile(dir);
      if (res.exitCode === -1 && !res.timedOut) {
        // the compiler itself could not be started: our outage, not the player's compile error
        cache.delete(key);
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
        return { dir, unavailable: true, error: `compiler not available: ${res.stderr.trim()}` };
      }
      if (res.exitCode !== 0) {
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
        return { dir, error: (res.stderr || res.stdout || 'Compilation failed').trim() };
      }
      return { dir };
    })();
    cache.set(key, build);
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  }
  return build;
}

// ---------------------------------------------------------------- docker

const DOCKER_IMAGES: Record<Language, string> = {
  python: process.env.DOCKER_IMAGE_PYTHON ?? 'python:3.12-slim',
  javascript: process.env.DOCKER_IMAGE_NODE ?? 'node:20-slim',
  java: process.env.DOCKER_IMAGE_JAVA ?? 'eclipse-temurin:21-jdk',
  cpp: process.env.DOCKER_IMAGE_CPP ?? 'gcc:13',
};

const SOURCE_FILES: Record<Language, string> = { python: 'main.py', javascript: 'main.js', java: 'Main.java', cpp: 'main.cpp' };
const COMPILED: ReadonlySet<Language> = new Set<Language>(['java', 'cpp']);

const COMPILE_FAILED_EXIT = 97;
const PROGRAM_FAILED_EXIT = 98;

/**
 * Runs each program in a throwaway, locked-down container: no network, capped
 * memory / CPU / processes, read-only root, unprivileged user. A self-hosted
 * alternative to Judge0 that only needs a Docker daemon.
 */
export class DockerRunner implements CodeRunner {
  readonly name = 'docker';

  constructor(private readonly dockerBin: string = process.env.DOCKER_BIN ?? 'docker') {}

  /** Pulls the language images in the background so the first submission isn't slow. */
  warmUp(): void {
    for (const image of Object.values(DOCKER_IMAGES)) {
      spawn(this.dockerBin, ['pull', '-q', image], { stdio: 'ignore', windowsHide: true })
        .on('error', err => console.error(`[runner] docker pull ${image} failed`, err))
        .on('exit', code => code !== 0 && console.error(`[runner] docker pull ${image} exited with ${code}`));
    }
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    // The source travels in an env var written to a client-side --env-file, so this also works
    // when the server itself runs in a container and talks to the host's Docker daemon.
    const dir = await mkdtemp(path.join(os.tmpdir(), 'codebattle-docker-'));
    const envFile = path.join(dir, 'env');
    const name = `codebattle-${randomBytes(6).toString('hex')}`;
    const file = SOURCE_FILES[request.language];
    // docker caps env-file lines at 64 KB, so the base64 source is split across several variables
    const encoded = Buffer.from(request.source, 'utf8').toString('base64');
    const chunks = encoded.match(/.{1,48000}/g) ?? [''];
    const vars = chunks.map((_c, i) => `"$CB_SRC_${i}"`).join(' ');
    const unpack = `mkdir -p /tmp/code && printf %s ${vars} | base64 -d > /tmp/code/${file} && unset ${chunks.map((_c, i) => `CB_SRC_${i}`).join(' ')} && `;
    // The program never runs as the container's main process: the wrapper shell reports its result as
    // 0 (ok) or PROGRAM_FAILED_EXIT, so the program can't fake a Docker failure (exit 125) and get its
    // submission withdrawn. Only the Docker CLI itself can produce 125.
    const program = {
      python: 'python3 -B /tmp/code/main.py',
      javascript: 'node /tmp/code/main.js',
      java: 'java -Xmx256m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Dfile.encoding=UTF-8 -cp /tmp/out Main',
      cpp: '/tmp/out/main',
    }[request.language];
    const compileCommand =
      request.language === 'java'
        ? 'javac -encoding UTF-8 -nowarn -d /tmp/out /tmp/code/Main.java'
        : `mkdir -p /tmp/out && g++ ${cppCompileFlags('linux').join(' ')} -o /tmp/out/main /tmp/code/main.cpp`;
    const compile = COMPILED.has(request.language)
      ? `${compileCommand} 2>/tmp/cerr || { cat /tmp/cerr >&2; exit ${COMPILE_FAILED_EXIT}; }; `
      : '';
    // a program killed by a signal exits 128+n in sh; report n so the player learns why it crashed
    const command = `${unpack}${compile}${program}; rc=$?; [ $rc -eq 0 ] && exit 0; [ $rc -gt 128 ] && echo "${SIGNAL_MARK}$((rc - 128))" >&2; exit ${PROGRAM_FAILED_EXIT}`;
    // container start (and javac) is not the player's time
    const overheadMs = request.language === 'java' ? 8000 : request.language === 'cpp' ? 15000 : 3000;
    try {
      const envLines = [...chunks.map((c, i) => `CB_SRC_${i}=${c}`), 'HOME=/tmp', 'PYTHONIOENCODING=utf-8'];
      await writeFile(envFile, `${envLines.join('\n')}\n`, 'utf8');
      const args = dockerRunArgs(request.language, name, envFile, command);
      const run = await runProcess(this.dockerBin, args, request.stdin, request.timeLimitMs + overheadMs, dir, process.env, () => {
        spawn(this.dockerBin, ['kill', name], { stdio: 'ignore', windowsHide: true }).on('error', () => undefined);
      });
      if (run.exitCode === COMPILE_FAILED_EXIT && COMPILED.has(request.language)) {
        return { status: 'compile_error', stdout: '', stderr: '', compileOutput: run.stderr.trim(), wallMs: run.durationMs };
      }
      // 125: docker itself failed (daemon down, image missing); -1: the docker CLI could not be started
      if (!run.timedOut && (run.exitCode === 125 || run.exitCode === -1)) {
        return { status: 'internal_error', stdout: '', stderr: run.stderr, wallMs: run.durationMs };
      }
      return toResult({ ...run, ...takeSignalMark(run.stderr) });
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

const SIGNAL_MARK = '__CB_SIGNAL__';

/** Strips the docker wrapper's signal line from stderr and returns the signal it reported. Exported for tests. */
export function takeSignalMark(stderr: string): { stderr: string; signal: NodeJS.Signals | null } {
  const match = new RegExp(`(^|\\n)${SIGNAL_MARK}(\\d+)\\n?$`).exec(stderr);
  if (!match) return { stderr, signal: null };
  const name = SIGNALS_BY_NUMBER[Number(match[2])] ?? match[2];
  return { stderr: stderr.slice(0, match.index) + match[1], signal: name as NodeJS.Signals };
}

/** `docker run` arguments for one sandboxed program run. Exported for tests. */
export function dockerRunArgs(
  language: Language,
  name: string,
  envFile: string,
  command: string,
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const stackBytes = CPP_STACK_LIMIT_KB * 1024;
  return [
    'run', '--rm', '-i', '--name', name, '--pull', 'never',
    ...(env.DOCKER_RUNTIME ? ['--runtime', env.DOCKER_RUNTIME] : []),
    '--network', 'none',
    '--memory', '384m', '--memory-swap', '384m',
    '--cpus', '1', '--pids-limit', '128',
    // deep recursion in C++ needs more than the default 8 MB stack (see CPP_STACK_LIMIT_KB)
    ...(language === 'cpp' ? ['--ulimit', `stack=${stackBytes}:${stackBytes}`] : []),
    '--read-only', '--tmpfs', '/tmp:rw,exec,nosuid,size=64m',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--user', '65534:65534',
    '--env-file', envFile,
    '-w', '/tmp',
    DOCKER_IMAGES[language],
    'sh', '-c', command,
  ];
}

// ---------------------------------------------------------------- judge0

const JUDGE0_LANGUAGE_IDS: Record<Language, number> = {
  python: Number(process.env.JUDGE0_PYTHON_ID ?? 71),
  javascript: Number(process.env.JUDGE0_JAVASCRIPT_ID ?? 63),
  java: Number(process.env.JUDGE0_JAVA_ID ?? 62),
  cpp: Number(process.env.JUDGE0_CPP_ID ?? 54),
};

/** Extra compiler flags per language (Judge0's g++ defaults to an older standard). Set to empty to send none. */
const JUDGE0_COMPILER_OPTIONS: Partial<Record<Language, string>> = {
  cpp: process.env.JUDGE0_CPP_COMPILER_OPTIONS ?? '-O2 -std=gnu++17',
};

interface Judge0Response {
  status?: { id: number; description: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  wall_time?: string | null;
  memory?: number | null;
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

/** The Judge0 submission body for one run. Exported for tests. */
export function judge0Submission(request: ExecutionRequest): Record<string, unknown> {
  const seconds = Math.min(Math.max(request.timeLimitMs / 1000, 1), 15);
  const compilerOptions = JUDGE0_COMPILER_OPTIONS[request.language];
  return {
    source_code: b64(request.source),
    language_id: JUDGE0_LANGUAGE_IDS[request.language],
    stdin: b64(request.stdin),
    cpu_time_limit: seconds,
    wall_time_limit: Math.min(seconds * 2, 20),
    memory_limit: 512000,
    // Judge0's own default is 64 MB; ask for the C++ stack size, within the server's maximum
    ...(request.language === 'cpp' ? { stack_limit: Math.min(CPP_STACK_LIMIT_KB, JUDGE0_MAX_STACK_LIMIT_KB) } : {}),
    ...(compilerOptions ? { compiler_options: compilerOptions } : {}),
    redirect_stderr_to_stdout: false,
  };
}
const unb64 = (s?: string | null) => (s ? Buffer.from(s, 'base64').toString('utf8') : '');

/** Judge0 (self-hosted or RapidAPI). Language ids are configurable per deployment. */
export class Judge0Runner implements CodeRunner {
  readonly name = 'judge0';

  constructor(
    private readonly baseUrl: string = process.env.JUDGE0_URL ?? 'http://localhost:2358',
    private readonly apiKey: string | undefined = process.env.JUDGE0_API_KEY || undefined
  ) {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const started = Date.now();
    try {
      const { data } = await axios.post<Judge0Response>(
        `${this.baseUrl}/submissions/`,
        judge0Submission(request),
        {
          params: { base64_encoded: true, wait: true },
          headers: this.apiKey ? { 'X-Auth-Token': this.apiKey, 'X-RapidAPI-Key': this.apiKey } : undefined,
          timeout: 60_000,
        }
      );
      const statusId = data.status?.id ?? 13;
      const result: ExecutionResult = {
        status: 'ok',
        stdout: unb64(data.stdout),
        stderr: unb64(data.stderr) || unb64(data.message),
        wallMs: Math.round(Number(data.wall_time ?? data.time ?? 0) * 1000) || Date.now() - started,
        memoryKb: data.memory ?? undefined,
      };
      if (statusId === 5) result.status = 'time_limit';
      else if (statusId === 6) {
        result.status = 'compile_error';
        result.compileOutput = unb64(data.compile_output);
      } else if (statusId >= 7 && statusId <= 12) {
        result.status = 'runtime_error';
        // Judge0 names the signal in the status ("Runtime Error (SIGSEGV)")
        const signal = /\bSIG[A-Z]+\b/.exec(data.status?.description ?? '')?.[0] ?? null;
        result.stderr = appendLine(result.stderr, crashDescription(signal));
      }
      else if (statusId >= 13) result.status = 'internal_error';
      return result;
    } catch (error) {
      // Judge0 explains a rejected submission in the body (e.g. 422 {"stack_limit":["must be less than or equal to 128000"]})
      const body = axios.isAxiosError(error) ? error.response?.data : undefined;
      const detail = body === undefined || body === '' ? '' : ` ${(typeof body === 'string' ? body : JSON.stringify(body)).slice(0, 300)}`;
      return { status: 'internal_error', stdout: '', stderr: `Judge0 request failed: ${(error as Error).message}${detail}`, wallMs: Date.now() - started };
    }
  }
}

// ---------------------------------------------------------------- selection

export type RunnerKind = 'judge0' | 'docker' | 'local';

/**
 * CODE_RUNNER picks the runner. Without it: judge0 when JUDGE0_URL or
 * JUDGE0_API_KEY is set, otherwise local (development).
 */
export function resolveRunnerKind(env: NodeJS.ProcessEnv = process.env): RunnerKind {
  const explicit = env.CODE_RUNNER?.toLowerCase();
  if (explicit === 'judge0' || explicit === 'local' || explicit === 'docker') return explicit;
  return env.JUDGE0_API_KEY || env.JUDGE0_URL ? 'judge0' : 'local';
}

/** The local runner executes untrusted code unsandboxed; refuse it in production unless forced. */
export function assertRunnerAllowed(kind: RunnerKind, env: NodeJS.ProcessEnv = process.env): void {
  if (kind === 'local' && env.NODE_ENV === 'production' && env.ALLOW_UNSAFE_LOCAL_RUNNER !== '1') {
    throw new Error(
      'CODE_RUNNER=local runs submissions without a sandbox and is disabled in production. ' +
        'Use CODE_RUNNER=docker or judge0 (or set ALLOW_UNSAFE_LOCAL_RUNNER=1 if you really mean it).'
    );
  }
}

export function createRunner(kind: RunnerKind = resolveRunnerKind()): CodeRunner {
  if (kind === 'judge0') return new Judge0Runner();
  if (kind === 'docker') return new DockerRunner();
  return new LocalProcessRunner();
}

let activeRunner: CodeRunner | null = null;

export function getRunner(): CodeRunner {
  if (!activeRunner) {
    const kind = resolveRunnerKind();
    assertRunnerAllowed(kind);
    activeRunner = createRunner(kind);
    if (activeRunner instanceof DockerRunner) activeRunner.warmUp();
    console.log(`[runner] using "${activeRunner.name}" code runner`);
  }
  return activeRunner;
}

export function setRunner(runner: CodeRunner | null): void {
  activeRunner = runner;
}

// ---------------------------------------------------------------- process helper

interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal?: NodeJS.Signals | null;
  timedOut: boolean;
  durationMs: number;
}

function toResult(run: ProcessResult): ExecutionResult {
  const status: ExecutionStatus = run.timedOut ? 'time_limit' : run.exitCode === 0 ? 'ok' : 'runtime_error';
  const crash = status === 'runtime_error' ? crashDescription(run.signal ?? null, run.exitCode) : undefined;
  return { status, stdout: run.stdout, stderr: appendLine(run.stderr, crash), wallMs: run.durationMs };
}

function appendLine(text: string, line: string | undefined): string {
  if (!line) return text;
  return text && !text.endsWith('\n') ? `${text}\n${line}` : `${text}${line}`;
}

const SIGNALS_BY_NUMBER: Record<number, string> = { 4: 'SIGILL', 6: 'SIGABRT', 7: 'SIGBUS', 8: 'SIGFPE', 9: 'SIGKILL', 11: 'SIGSEGV' };
/** Windows NTSTATUS exit codes of crashed native programs (MinGW builds). */
const WINDOWS_CRASHES: Record<number, string> = {
  0xc00000fd: 'Stack overflow: recursion too deep',
  0xc0000005: 'Access violation: invalid memory access (null or dangling pointer, out-of-bounds index)',
  0xc0000094: 'Arithmetic error: integer division by zero',
  0xc0000409: 'Aborted: a failed assertion, a bounds check or an uncaught exception',
};

/**
 * A readable explanation of a program killed by a signal (or a Windows crash code),
 * so a stack overflow or a null dereference isn't just "Program exited unexpectedly".
 * Undefined for ordinary non-zero exits.
 */
export function crashDescription(signal: string | null, exitCode: number | null = null): string | undefined {
  if (signal === null && exitCode !== null && exitCode >>> 0 in WINDOWS_CRASHES) return WINDOWS_CRASHES[exitCode >>> 0];
  if (signal === null) return undefined;
  const name = /^\d+$/.test(signal) ? SIGNALS_BY_NUMBER[Number(signal)] ?? `signal ${signal}` : signal;
  switch (name) {
    case 'SIGSEGV':
    case 'SIGBUS':
      return `Segmentation fault (${name}): invalid memory access (null or dangling pointer, out-of-bounds index) or a stack overflow from too-deep recursion`;
    case 'SIGFPE':
      return 'Arithmetic error (SIGFPE): integer division by zero or overflow';
    case 'SIGABRT':
      return 'Aborted (SIGABRT): a failed assertion, a bounds check or an uncaught exception';
    case 'SIGKILL':
      return 'Killed (SIGKILL), most likely for using too much memory';
    case 'SIGILL':
      return 'Illegal instruction (SIGILL): often a function that returns a value but reached its end without a return';
    default:
      return `Killed by ${name}`;
  }
}

function runProcess(
  cmd: string,
  args: string[],
  stdin: string,
  timeoutMs: number,
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  onTimeout?: () => void
): Promise<ProcessResult> {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(cmd, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      onTimeout?.();
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      if (stdout.length < OUTPUT_LIMIT) stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      if (stderr.length < OUTPUT_LIMIT) stderr += chunk.toString();
    });
    child.on('error', err => {
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr + String(err), exitCode: -1, timedOut, durationMs: Date.now() - started });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code, signal, timedOut, durationMs: Date.now() - started });
    });

    child.stdin.on('error', () => undefined);
    child.stdin.end(stdin);
  });
}
