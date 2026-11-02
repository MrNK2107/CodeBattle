import { execSync } from 'child_process';
import { describe, expect, it } from 'vitest';
import { JAVA_TYPES, functionNameFor, starterCode, type Language, type ProblemSignature, type ValueType } from '@codebattle/shared';
import { questionBank } from '../../../../packages/problems/src';
import { judge } from '../services/judge';
import { LocalProcessRunner, type CodeRunner } from '../services/runners';
import { cppRunner } from './support/cpp';

/*
 * Every question's signature must survive the full harness in every language:
 * a stub that returns a well-typed default has to compile, run and be judged
 * (as a wrong answer or, by luck, accepted) without crashing the driver.
 */

const has = (cmd: string) => {
  try {
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const available: Record<Language, boolean> = {
  javascript: true,
  python: has(`${process.platform === 'win32' ? 'python' : 'python3'} --version`),
  java: has('javac -version') && has('java -version'),
  cpp: cppRunner() !== null,
};

const JS_DEFAULT: Record<ValueType, string> = {
  int: '0', long: '0', double: '0', bool: 'false', string: '""',
  'int[]': '[]', 'double[]': '[]', 'bool[]': '[]', 'string[]': '[]',
  'int[][]': '[]', 'string[][]': '[]', 'char[][]': '[]', ListNode: 'null', TreeNode: 'null',
};
const PY_DEFAULT: Record<ValueType, string> = {
  ...JS_DEFAULT, bool: 'False', ListNode: 'None', TreeNode: 'None',
};
const JAVA_DEFAULT: Record<ValueType, string> = {
  int: '0', long: '0L', double: '0.0', bool: 'false', string: '""',
  'int[]': 'new int[0]', 'double[]': 'new double[0]', 'bool[]': 'new boolean[0]', 'string[]': 'new String[0]',
  'int[][]': 'new int[0][]', 'string[][]': 'new ArrayList<>()', 'char[][]': 'new char[0][]', ListNode: 'null', TreeNode: 'null',
};

function stub(signature: ProblemSignature, language: Language): string {
  const starter = starterCode(signature, language);
  if (language === 'python') return starter.replace('    pass\n', `    return ${PY_DEFAULT[signature.returns]}\n`);
  if (language === 'javascript') return starter.replace('{\n  \n}', `{\n  return ${JS_DEFAULT[signature.returns]};\n}`);
  // value-initialised: 0, false, empty containers, nullptr
  if (language === 'cpp') return starter.replace(/\{\n        \n    \}/, '{\n        return {};\n    }');
  const returns = signature.javaReturns ?? JAVA_TYPES[signature.returns];
  const value = returns.startsWith('List<') ? 'new ArrayList<>()' : JAVA_DEFAULT[signature.returns];
  return starter.replace(/\{\n        \n    \}/, `{\n        return ${value};\n    }`);
}

const local = new LocalProcessRunner();
const runnerFor = (language: Language): CodeRunner => (language === 'cpp' ? cppRunner()! : local);

for (const language of ['javascript', 'python', 'java', 'cpp'] as Language[]) {
  describe.skipIf(!available[language])(`starter stubs (${language})`, () => {
    it.each(questionBank.map(q => [q.slug, q] as const))(
      '%s',
      async (_slug, q) => {
        const code = stub(q.signature, language);
        expect(code).toContain(functionNameFor(q.signature, language));
        const result = await judge(q.signature, language, code, q.examples.map(e => ({ args: e.args, expected: e.expected })), runnerFor(language));
        expect(result.message ?? '', JSON.stringify(result.outcomes).slice(0, 500)).toBe('');
        expect(['WRONG_ANSWER', 'ACCEPTED']).toContain(result.verdict);
      },
      120_000
    );
  });
}
