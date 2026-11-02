import type { Language } from '@codebattle/shared';

export interface QualityIssue {
  message: string;
  line?: number;
  penalty: number;
}

export interface QualityReport {
  score: number;
  issues: QualityIssue[];
}

const MAX_LINE = 120;

/**
 * Lightweight static checks that work the same for every language: deep
 * nesting, very long lines and functions, leftover debug output and TODOs,
 * swallowed exceptions and dynamic code execution. Deterministic and cheap, so
 * it runs on every submission without a linter toolchain.
 */
export function analyzeQuality(language: Language, code: string): QualityReport {
  const issues: QualityIssue[] = [];
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const add = (message: string, penalty: number, line?: number) => issues.push({ message, penalty, line });

  const commentPrefix = language === 'python' ? '#' : '//';
  const isCode = (l: string) => l.trim() !== '' && !l.trim().startsWith(commentPrefix) && !l.trim().startsWith('*') && !l.trim().startsWith('/*');

  // long lines
  const longLines = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.length > MAX_LINE);
  if (longLines.length) add(`${longLines.length} line(s) longer than ${MAX_LINE} characters`, Math.min(longLines.length * 2, 10), longLines[0].i + 1);

  // nesting depth
  const depth = language === 'python' ? pythonDepth(lines, isCode) : braceDepth(code);
  if (depth.max > 4) add(`Nesting depth ${depth.max} (keep it at 4 or less)`, Math.min((depth.max - 4) * 8, 30), depth.line);

  // debug output left in the solution
  const debug = {
    python: /^\s*print\s*\(/,
    javascript: /\bconsole\.(log|debug|info)\s*\(/,
    java: /\bSystem\.(out|err)\.print/,
    cpp: /\b(cout|cerr)\s*<<|\b(printf|puts)\s*\(/,
  }[language];
  const debugLines = lines.map((l, i) => ({ l, i })).filter(({ l }) => isCode(l) && debug.test(l));
  if (debugLines.length) add(`${debugLines.length} leftover debug print(s)`, Math.min(debugLines.length * 4, 12), debugLines[0].i + 1);

  // TODO / FIXME markers
  const todo = lines.findIndex(l => /\b(TODO|FIXME|XXX)\b/.test(l));
  if (todo !== -1) add('TODO/FIXME comment left in', 3, todo + 1);

  // swallowed exceptions
  const swallow =
    language === 'python'
      ? /except[^:]*:\s*\n\s*pass\b/
      : /catch\s*(\([^)]*\))?\s*\{\s*\}/;
  if (swallow.test(code)) add('Exception caught and ignored', 10);

  // dynamic code execution
  const dynamic = {
    python: /\b(eval|exec)\s*\(/,
    javascript: /\beval\s*\(|new\s+Function\s*\(/,
    java: /Runtime\.getRuntime\(\)\.exec/,
    cpp: /\b(system|popen|exec[lv]p?e?)\s*\(/,
  }[language];
  if (dynamic.test(code)) add('Dynamic code execution (eval/exec)', 20);

  // overly long code for a single puzzle
  const codeLines = lines.filter(isCode).length;
  if (codeLines > 120) add(`${codeLines} lines of code; a tighter solution is easier to follow`, Math.min(Math.floor((codeLines - 120) / 20) * 3 + 3, 15));

  // one-letter names beyond the usual loop / math variables
  const letters = new Set<string>();
  const decl =
    language === 'python'
      ? /(?:^|[\s,(])([a-zA-Z])\s*=(?!=)/g
      : /\b(?:let|const|var|int|long|double|boolean|bool|char|String|string|auto)\s+([a-zA-Z])\b/g;
  for (const m of code.matchAll(decl)) letters.add(m[1]);
  const unusual = [...letters].filter(c => !'ijkxyznmlrcabdpqstuvwehfgo'.includes(c.toLowerCase()));
  if (unusual.length >= 3) add('Several one-letter variable names', 4);

  const penalty = issues.reduce((sum, i) => sum + i.penalty, 0);
  return { score: Math.max(0, 100 - penalty), issues };
}

function braceDepth(code: string): { max: number; line?: number } {
  // strip strings and comments so braces inside them don't count
  const stripped = code
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '')
    .replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
  let depth = 0;
  let max = 0;
  let line = 1;
  let maxLine: number | undefined;
  for (const ch of stripped) {
    if (ch === '\n') line++;
    else if (ch === '{') {
      depth++;
      if (depth > max) {
        max = depth;
        maxLine = line;
      }
    } else if (ch === '}') depth = Math.max(0, depth - 1);
  }
  // the function body (and the class around it in Java) are not "nesting"
  return { max: Math.max(0, max - (/\bclass\s+\w+/.test(code) ? 2 : 1)), line: maxLine };
}

function pythonDepth(lines: string[], isCode: (l: string) => boolean): { max: number; line?: number } {
  const indents = lines.filter(isCode).map(l => l.match(/^[ \t]*/)![0].replace(/\t/g, '    ').length);
  const unit = Math.min(...indents.filter(n => n > 0), 4) || 4;
  let max = 0;
  let line: number | undefined;
  lines.forEach((l, i) => {
    if (!isCode(l)) return;
    const level = Math.floor(l.match(/^[ \t]*/)![0].replace(/\t/g, '    ').length / unit);
    if (level > max) {
      max = level;
      line = i + 1;
    }
  });
  // the function body (and a Solution class) are not "nesting"
  const base = lines.some(l => /^\s*class\s+\w+/.test(l)) ? 2 : 1;
  return { max: Math.max(0, max - base), line };
}
