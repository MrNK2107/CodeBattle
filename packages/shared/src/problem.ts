/**
 * Problem model shared by the server (judging), the web app (rendering) and the
 * question bank (seeding). Test inputs are JSON arrays of positional arguments,
 * expected outputs are JSON values.
 */

export const LANGUAGES = ['python', 'javascript', 'java', 'cpp'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: 'Python 3',
  javascript: 'JavaScript',
  java: 'Java',
  cpp: 'C++',
};

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

export type ValueType =
  | 'int'
  | 'long'
  | 'double'
  | 'bool'
  | 'string'
  | 'int[]'
  | 'double[]'
  | 'bool[]'
  | 'string[]'
  | 'int[][]'
  | 'string[][]'
  | 'char[][]'
  | 'ListNode'
  | 'TreeNode';

/**
 * exact: deep equality (numbers within 1e-6)
 * unordered: the top-level list may be in any order
 * unordered-nested: the top-level list and every inner list may be in any order
 */
export type CompareMode = 'exact' | 'unordered' | 'unordered-nested';

export interface ProblemParam {
  name: string;
  type: ValueType;
}

export interface ProblemSignature {
  /** camelCase; Python uses the snake_case form */
  functionName: string;
  params: ProblemParam[];
  returns: ValueType;
  compare?: CompareMode;
  /** Java return type when it differs from the default mapping (e.g. List<List<Integer>>) */
  javaReturns?: string;
}

/** An expected value of `{ "$oneOf": [a, b] }` accepts any of the listed answers. */
export interface OneOf {
  $oneOf: unknown[];
}

export function isOneOf(value: unknown): value is OneOf {
  return typeof value === 'object' && value !== null && Array.isArray((value as OneOf).$oneOf);
}

// ---------------------------------------------------------------- naming

export function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

export function functionNameFor(signature: ProblemSignature, language: Language): string {
  return language === 'python' ? toSnakeCase(signature.functionName) : signature.functionName;
}

// ---------------------------------------------------------------- comparison

const EPSILON = 1e-6;

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === 'number' ? Number(v.toPrecision(12)) : v));
}

function sortList(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return [...value].sort((a, b) => (canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0));
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isInteger(a) && Number.isInteger(b)) return a === b;
    return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (!deepEqual(ka, kb)) return false;
    return ka.every(k => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a === b;
}

function normalizeFor(mode: CompareMode, value: unknown): unknown {
  if (mode === 'unordered') return sortList(value);
  if (mode === 'unordered-nested') return Array.isArray(value) ? sortList(value.map(sortList)) : value;
  return value;
}

export function valuesMatch(expected: unknown, actual: unknown, mode: CompareMode = 'exact'): boolean {
  if (isOneOf(expected)) return expected.$oneOf.some(option => valuesMatch(option, actual, mode));
  return deepEqual(normalizeFor(mode, expected), normalizeFor(mode, actual));
}

// ---------------------------------------------------------------- display

export function formatValue(value: unknown): string {
  if (isOneOf(value)) return value.$oneOf.map(formatValue).join(' or ');
  return JSON.stringify(value) ?? 'undefined';
}

/** `nums = [2,7,11,15], target = 9` */
export function formatArgs(params: ProblemParam[], args: unknown[]): string {
  return params.map((p, i) => `${p.name} = ${formatValue(args[i])}`).join(', ');
}

// ---------------------------------------------------------------- starter code

const PY_TYPES: Record<ValueType, string> = {
  int: 'int',
  long: 'int',
  double: 'float',
  bool: 'bool',
  string: 'str',
  'int[]': 'List[int]',
  'double[]': 'List[float]',
  'bool[]': 'List[bool]',
  'string[]': 'List[str]',
  'int[][]': 'List[List[int]]',
  'string[][]': 'List[List[str]]',
  'char[][]': 'List[List[str]]',
  ListNode: 'Optional[ListNode]',
  TreeNode: 'Optional[TreeNode]',
};

const JS_TYPES: Record<ValueType, string> = {
  int: 'number',
  long: 'number',
  double: 'number',
  bool: 'boolean',
  string: 'string',
  'int[]': 'number[]',
  'double[]': 'number[]',
  'bool[]': 'boolean[]',
  'string[]': 'string[]',
  'int[][]': 'number[][]',
  'string[][]': 'string[][]',
  'char[][]': 'string[][]',
  ListNode: 'ListNode | null',
  TreeNode: 'TreeNode | null',
};

export const JAVA_TYPES: Record<ValueType, string> = {
  int: 'int',
  long: 'long',
  double: 'double',
  bool: 'boolean',
  string: 'String',
  'int[]': 'int[]',
  'double[]': 'double[]',
  'bool[]': 'boolean[]',
  'string[]': 'String[]',
  'int[][]': 'int[][]',
  'string[][]': 'List<List<String>>',
  'char[][]': 'char[][]',
  ListNode: 'ListNode',
  TreeNode: 'TreeNode',
};

/** C++ types as they appear in the starter code; containers are taken by reference, LeetCode style. */
export const CPP_TYPES: Record<ValueType, string> = {
  int: 'int',
  long: 'long long',
  double: 'double',
  bool: 'bool',
  string: 'string',
  'int[]': 'vector<int>',
  'double[]': 'vector<double>',
  'bool[]': 'vector<bool>',
  'string[]': 'vector<string>',
  'int[][]': 'vector<vector<int>>',
  'string[][]': 'vector<vector<string>>',
  'char[][]': 'vector<vector<char>>',
  ListNode: 'ListNode*',
  TreeNode: 'TreeNode*',
};

export function cppParamType(type: ValueType): string {
  return CPP_TYPES[type].startsWith('vector<') ? `${CPP_TYPES[type]}&` : CPP_TYPES[type];
}

function usesType(signature: ProblemSignature, type: ValueType): boolean {
  return signature.returns === type || signature.params.some(p => p.type === type);
}

export function starterCode(signature: ProblemSignature, language: Language): string {
  const name = functionNameFor(signature, language);
  const list = usesType(signature, 'ListNode');
  const tree = usesType(signature, 'TreeNode');

  if (language === 'python') {
    const header: string[] = [];
    if (list) header.push('# class ListNode:  (provided)\n#     def __init__(self, val=0, next=None): ...');
    if (tree) header.push('# class TreeNode:  (provided)\n#     def __init__(self, val=0, left=None, right=None): ...');
    const params = signature.params.map(p => `${toSnakeCase(p.name)}: ${PY_TYPES[p.type]}`).join(', ');
    return `${header.length ? header.join('\n') + '\n\n' : ''}def ${name}(${params}) -> ${PY_TYPES[signature.returns]}:\n    pass\n`;
  }

  if (language === 'javascript') {
    const header: string[] = [];
    if (list) header.push('// class ListNode { val; next }  (provided)');
    if (tree) header.push('// class TreeNode { val; left; right }  (provided)');
    const doc = [
      '/**',
      ...signature.params.map(p => ` * @param {${JS_TYPES[p.type]}} ${p.name}`),
      ` * @return {${JS_TYPES[signature.returns]}}`,
      ' */',
    ].join('\n');
    const params = signature.params.map(p => p.name).join(', ');
    return `${header.length ? header.join('\n') + '\n\n' : ''}${doc}\nfunction ${name}(${params}) {\n  \n}\n`;
  }

  if (language === 'cpp') {
    const header: string[] = [];
    if (list) header.push('// struct ListNode { int val; ListNode *next; }  (provided)');
    if (tree) header.push('// struct TreeNode { int val; TreeNode *left, *right; }  (provided)');
    const params = signature.params.map(p => `${cppParamType(p.type)} ${p.name}`).join(', ');
    const preamble = header.length ? header.join('\n') + '\n\n' : '';
    return `#include <bits/stdc++.h>\nusing namespace std;\n\n${preamble}class Solution {\npublic:\n    ${CPP_TYPES[signature.returns]} ${name}(${params}) {\n        \n    }\n};\n`;
  }

  const header: string[] = [];
  if (list) header.push('// class ListNode { int val; ListNode next; }  (provided)');
  if (tree) header.push('// class TreeNode { int val; TreeNode left, right; }  (provided)');
  const params = signature.params.map(p => `${JAVA_TYPES[p.type]} ${p.name}`).join(', ');
  const returns = signature.javaReturns ?? JAVA_TYPES[signature.returns];
  return `import java.util.*;\n\n${header.length ? header.join('\n') + '\n\n' : ''}class Solution {\n    public ${returns} ${name}(${params}) {\n        \n    }\n}\n`;
}

export function allStarterCode(signature: ProblemSignature): Record<Language, string> {
  return {
    python: starterCode(signature, 'python'),
    javascript: starterCode(signature, 'javascript'),
    java: starterCode(signature, 'java'),
    cpp: starterCode(signature, 'cpp'),
  };
}

/** Starter code stored before a language was added is filled in from the signature. */
export function completeStarterCode(stored: unknown, signature: ProblemSignature | null | undefined): Record<Language, string> {
  const saved = stored && typeof stored === 'object' ? (stored as Partial<Record<Language, string>>) : {};
  if (!signature) return saved as Record<Language, string>;
  return { ...allStarterCode(signature), ...saved };
}
