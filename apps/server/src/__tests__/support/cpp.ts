import { execSync, spawn } from 'child_process';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { cppCompileFlags, CPP_STACK_LIMIT_KB, crashDescription, LocalProcessRunner, withCppStack, type CodeRunner, type ExecutionRequest, type ExecutionResult } from '../../services/runners';

/*
 * Finds a C++ toolchain for the tests: g++ on PATH (or CXX_BIN), otherwise g++
 * inside WSL on Windows. Returns null when neither exists so suites can skip.
 */

const works = (cmd: string) => {
  try {
    execSync(cmd, { stdio: 'ignore', timeout: 20_000 });
    return true;
  } catch {
    return false;
  }
};

function run(cmd: string, args: string[], stdin: string, timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean; ms: number }>(resolve => {
    const started = Date.now();
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', c => (stdout += c.toString()));
    child.stderr.on('data', c => (stderr += c.toString()));
    child.on('error', err => {
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr + String(err), code: -1, timedOut, ms: Date.now() - started });
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut, ms: Date.now() - started });
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(stdin);
  });
}

function toWslPath(p: string): string {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(p);
  if (!m) throw new Error(`cannot map ${p} into WSL`);
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`;
}

/** Compiles and runs inside WSL (Windows hosts without a native g++). Test-only. */
export class WslCppRunner implements CodeRunner {
  readonly name = 'wsl-cpp';
  private readonly builds = new Map<string, Promise<string | undefined>>();

  /** stackKb: the stack the program gets, as the real runners would give it (CPP_STACK_LIMIT_KB). */
  constructor(private readonly stackKb: number = CPP_STACK_LIMIT_KB) {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    if (request.language !== 'cpp') throw new Error('WslCppRunner only runs C++');
    const key = createHash('sha256').update(request.source).digest('hex').slice(0, 24);
    let build = this.builds.get(key);
    if (!build) {
      build = (async () => {
        const dir = path.join(os.tmpdir(), 'codebattle-wsl-cpp', key);
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, 'main.cpp'), request.source, 'utf8');
        const res = await run('wsl', ['-e', 'g++', ...cppCompileFlags('linux'), '-o', `/tmp/codebattle-${key}`, `${toWslPath(dir)}/main.cpp`], '', 120_000);
        return res.code === 0 ? undefined : (res.stderr || res.stdout || 'Compilation failed').trim();
      })();
      this.builds.set(key, build);
    }
    const error = await build;
    if (error !== undefined) return { status: 'compile_error', stdout: '', stderr: '', compileOutput: error, wallMs: 0 };
    // wsl start-up is not the program's time
    // started exactly as LocalProcessRunner starts it on Linux (sh wrapper raising the stack)
    const start = withCppStack(`/tmp/codebattle-${key}`, 'linux', this.stackKb);
    const res = await run('wsl', ['-e', start.cmd, ...start.args], request.stdin, request.timeLimitMs + 3000);
    const status = res.timedOut ? 'time_limit' : res.code === 0 ? 'ok' : 'runtime_error';
    // wsl.exe passes on the Linux exit status: 128+n when the program died from signal n
    const crash = status === 'runtime_error' && res.code !== null && res.code > 128 ? crashDescription(String(res.code - 128)) : undefined;
    return {
      status,
      stdout: res.stdout,
      stderr: crash ? `${res.stderr}${crash}` : res.stderr,
      wallMs: res.ms,
    };
  }
}

let cached: CodeRunner | null | undefined;

export function cppRunner(): CodeRunner | null {
  if (cached !== undefined) return cached;
  const cxx = process.env.CXX_BIN ?? 'g++';
  if (works(`${cxx} --version`)) cached = new LocalProcessRunner(undefined, undefined, undefined, cxx);
  else if (process.platform === 'win32' && works('wsl -e g++ --version')) cached = new WslCppRunner();
  else cached = null;
  return cached;
}
