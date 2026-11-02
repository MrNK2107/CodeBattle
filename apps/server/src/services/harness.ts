/**
 * Wraps a player's solution in a per-language driver so that LeetCode-style
 * function stubs can be judged.
 *
 * The program reads `{"nonce": string, "tests": unknown[][]}` from stdin, calls
 * the player's function once per test with the decoded arguments, and prints one
 * line per test: `<nonce>{"i":0,"ok":true,"value":...,"ms":1.2,"stdout":"..."}`.
 * Output the player prints is captured per test instead of mixing with results.
 */
import { JAVA_TYPES, functionNameFor, toSnakeCase, type Language, type ProblemSignature, type ValueType } from '@codebattle/shared';

export interface BuiltProgram {
  source: string;
  /** lines of driver code placed before the player's code (used to remap line numbers) */
  prefixLines: number;
}

export interface DriverLine {
  i: number;
  ok: boolean;
  value?: unknown;
  ms?: number;
  error?: string;
  stdout?: string;
}

export interface ParsedOutput {
  lines: DriverLine[];
  fatal?: string;
  /** a test reported twice, an unknown index or an impossible timing: the output can't be trusted */
  tampered?: boolean;
}

export function buildProgram(language: Language, signature: ProblemSignature, code: string): BuiltProgram {
  if (language === 'python') return buildPython(signature, code);
  if (language === 'javascript') return buildJavaScript(signature, code);
  if (language === 'cpp') return buildCpp(signature, code);
  return buildJava(signature, code);
}

export function buildStdin(nonce: string, tests: unknown[][]): string {
  return JSON.stringify({ nonce, tests });
}

export function parseDriverOutput(stdout: string, nonce: string, testCount: number = Number.POSITIVE_INFINITY): ParsedOutput {
  const lines: DriverLine[] = [];
  const seen = new Set<number>();
  let fatal: string | undefined;
  let tampered = false;
  for (const raw of stdout.split(/\r?\n/)) {
    const at = raw.indexOf(nonce);
    if (at === -1) continue;
    let parsed: DriverLine & { fatal?: string };
    try {
      parsed = JSON.parse(raw.slice(at + nonce.length)) as DriverLine & { fatal?: string };
    } catch {
      // a truncated final line (process killed mid-write) is ignored
      continue;
    }
    if (parsed.fatal) {
      fatal = parsed.fatal;
      continue;
    }
    const valid =
      Number.isInteger(parsed.i) &&
      parsed.i >= 0 &&
      parsed.i < testCount &&
      !seen.has(parsed.i) &&
      (parsed.ms === undefined || (typeof parsed.ms === 'number' && Number.isFinite(parsed.ms) && parsed.ms >= 0));
    if (!valid) {
      tampered = true;
      continue;
    }
    seen.add(parsed.i);
    lines.push(parsed);
  }
  return { lines, fatal, tampered };
}

/** Shift `line N` style references in compiler / interpreter output back to the player's numbering. */
export function remapLineNumbers(language: Language, text: string, prefixLines: number): string {
  if (!text) return text;
  const shift = (n: string) => String(Math.max(Number(n) - prefixLines, 1));
  if (language === 'python') {
    return text.replace(/File "[^"]*", line (\d+)/g, (_m, n) => `line ${shift(n)}`);
  }
  if (language === 'javascript') {
    return text.replace(/[^\s()]*\.js:(\d+)(:\d+)?/g, (_m, n, col) => `line ${shift(n)}${col ?? ''}`);
  }
  if (language === 'cpp') {
    return text
      .replace(/\S*?main\.cpp:(\d+)/g, (_m, n) => `line ${shift(n)}`)
      .replace(/\S*?main\.cpp:\s*/g, '');
  }
  return text.replace(/\S*?Main\.java:(\d+)/g, (_m, n) => `line ${shift(n)}`);
}

function countLines(text: string): number {
  return text.split('\n').length - 1;
}

function candidateNames(signature: ProblemSignature): string[] {
  const names = [signature.functionName, toSnakeCase(signature.functionName)];
  return Array.from(new Set(names));
}

// ---------------------------------------------------------------- python

const PY_HEADER = `from __future__ import annotations
import sys, json, math, io, time, traceback, threading, collections, heapq, bisect, itertools, functools, string, re, random
from typing import *
from collections import defaultdict, deque, Counter, OrderedDict
from functools import lru_cache, reduce
from heapq import heappush, heappop, heapify
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
`;

/*
 * The driver reads the tests and captures the clock and the real stdout before
 * the player's code runs, then hands back a single-use runner. (Python offers
 * enough introspection that this is a speed bump rather than a wall; the judge
 * additionally rejects duplicated or impossible result lines.)
 */
function pythonBoot(signature: ProblemSignature, prefixLinesAfter: (bootLines: number) => number, userLines: number): string {
  const types = JSON.stringify(signature.params.map(p => p.type));
  const missing = `Function ${functionNameFor(signature, 'python')} was not found. Keep the function name from the starter code.`;
  // prefix is only known once this text is built, so it is passed in through a placeholder
  const body = `def __cb_boot():
    _clock = time.perf_counter
    _out = sys.stdout
    _write = _out.write
    _flush = _out.flush
    _dumps = json.dumps
    _data = json.loads(sys.stdin.read())
    _mark = _data["nonce"]
    _tests = _data["tests"]
    _types = ${types}
    _used = []

    def to_list(values):
        head = None
        for v in reversed(values):
            head = ListNode(v, head)
        return head

    def to_tree(values):
        if not values or values[0] is None:
            return None
        root = TreeNode(values[0])
        queue = deque([root])
        i = 1
        while queue and i < len(values):
            node = queue.popleft()
            if i < len(values) and values[i] is not None:
                node.left = TreeNode(values[i])
                queue.append(node.left)
            i += 1
            if i < len(values) and values[i] is not None:
                node.right = TreeNode(values[i])
                queue.append(node.right)
            i += 1
        return root

    def convert(t, v):
        if t == "ListNode":
            return to_list(v)
        if t == "TreeNode":
            return to_tree(v)
        if t == "double":
            return float(v)
        return v

    def ser(v):
        if v is None or isinstance(v, (bool, int, str)):
            return v
        if isinstance(v, float):
            return v if math.isfinite(v) else None
        if hasattr(v, "val") and hasattr(v, "left") and hasattr(v, "right"):
            out, queue = [], deque([v])
            while queue and len(out) < 200000:
                node = queue.popleft()
                if node is None:
                    out.append(None)
                    continue
                out.append(ser(node.val))
                queue.append(node.left)
                queue.append(node.right)
            while out and out[-1] is None:
                out.pop()
            return out
        if hasattr(v, "val") and hasattr(v, "next"):
            out, node = [], v
            while node is not None and len(out) < 200000:
                out.append(ser(node.val))
                node = node.next
            return out
        if isinstance(v, dict):
            return {str(k): ser(x) for k, x in v.items()}
        if isinstance(v, (list, tuple, set, frozenset, deque)):
            return [ser(x) for x in v]
        return str(v)

    def describe(e):
        lo, hi = __CB_PREFIX__, __CB_PREFIX__ + ${userLines}
        user = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == __file__ and lo < f.lineno <= hi]
        where = " (line %d)" % (user[-1].lineno - lo) if user else ""
        return "%s: %s%s" % (type(e).__name__, e, where)

    def emit(i, ok, payload, printed):
        # assembled by hand so nothing the player returns can add or replace fields
        line = '{"i":%d,"ok":%s,%s,"stdout":%s}' % (i, "true" if ok else "false", payload, _dumps(printed[-2000:]))
        _write(_mark + line + "\\n")
        _flush()

    def main(fn):
        for i, raw in enumerate(_tests):
            buf = io.StringIO()
            sys.stdout = buf
            try:
                args = [convert(t, v) for t, v in zip(_types, raw)]
                started = _clock()
                result = fn(*args)
                ms = (_clock() - started) * 1000
                sys.stdout = _out
                payload = '"ms":%r,"value":%s' % (float(ms), _dumps(ser(result)))
                ok = True
            except BaseException as e:
                sys.stdout = _out
                payload = '"error":%s' % _dumps(describe(e))
                ok = False
            emit(i, ok, payload, buf.getvalue())

    def run(find):
        if _used:
            return
        _used.append(True)
        fn = find()
        if fn is None:
            _write(_mark + _dumps({"fatal": ${JSON.stringify(missing)}}) + "\\n")
            return
        sys.setrecursionlimit(200000)
        for size in (256, 128, 64, 32):
            try:
                threading.stack_size(size * 1024 * 1024)
                break
            except (ValueError, RuntimeError):
                pass
        thread = threading.Thread(target=main, args=(fn,))
        thread.start()
        thread.join()

    return run
__cb_run = __cb_boot()
del __cb_boot
`;
  const prefix = prefixLinesAfter(countLines(body));
  return body.split('__CB_PREFIX__').join(String(prefix));
}

function buildPython(signature: ProblemSignature, code: string): BuiltProgram {
  const userLines = countLines(code) + 1;
  let prefixLines = 0;
  const boot = pythonBoot(signature, bootLines => (prefixLines = countLines(PY_HEADER) + bootLines), userLines);
  const names = JSON.stringify(candidateNames(signature).concat(functionNameFor(signature, 'python')));
  const finder = `
def __cb_find():
    g = globals()
    for name in ${names}:
        if callable(g.get(name)) and not isinstance(g.get(name), type):
            return g[name]
    if isinstance(g.get("Solution"), type):
        inst = g["Solution"]()
        for name in ${names}:
            if callable(getattr(inst, name, None)):
                return getattr(inst, name)
    return None
__cb_run(__cb_find)
`;
  return { source: `${PY_HEADER}${boot}${code}\n${finder}`, prefixLines };
}

// ---------------------------------------------------------------- javascript

/*
 * Everything the driver relies on (stdin, nonce, clock, writer, JSON) is
 * captured in a closure before the player's code runs, so monkeypatching
 * globals afterwards can't forge results or timings.
 */
function jsBoot(signature: ProblemSignature, userLinesFrom: () => number, prefixFrom: () => number): string {
  const types = JSON.stringify(signature.params.map(p => p.type));
  const name = signature.functionName;
  return `const __cb_run = (() => {
  const fs = require('fs');
  const util = require('util');
  const write = fs.writeSync.bind(fs);
  const hr = process.hrtime.bigint.bind(process.hrtime);
  const parse = JSON.parse;
  const stringify = JSON.stringify;
  const data = parse(fs.readFileSync(0, 'utf8'));
  const mark = data.nonce;
  const tests = data.tests;
  const types = ${types};
  const stdout = process.stdout;
  const original = { log: console.log, info: console.info, debug: console.debug, write: stdout.write };
  let used = false;
  const toList = values => { let head = null; for (let i = values.length - 1; i >= 0; i--) head = new ListNode(values[i], head); return head; };
  const toTree = values => {
    if (!values.length || values[0] === null) return null;
    const root = new TreeNode(values[0]); const queue = [root]; let i = 1, q = 0;
    while (q < queue.length && i < values.length) {
      const node = queue[q++];
      if (i < values.length && values[i] !== null) { node.left = new TreeNode(values[i]); queue.push(node.left); } i++;
      if (i < values.length && values[i] !== null) { node.right = new TreeNode(values[i]); queue.push(node.right); } i++;
    }
    return root;
  };
  const convert = (t, v) => (t === 'ListNode' ? toList(v) : t === 'TreeNode' ? toTree(v) : v);
  const ser = v => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v !== 'object') return v;
    if ('val' in v && 'left' in v && 'right' in v) {
      const out = []; const queue = [v]; let q = 0;
      while (q < queue.length && out.length < 200000) { const n = queue[q++]; if (!n) { out.push(null); continue; } out.push(ser(n.val)); queue.push(n.left, n.right); }
      while (out.length && out[out.length - 1] === null) out.pop();
      return out;
    }
    if ('val' in v && 'next' in v) { const out = []; let n = v; while (n && out.length < 200000) { out.push(ser(n.val)); n = n.next; } return out; }
    if (v instanceof Map) return Object.fromEntries([...v].map(([k, x]) => [String(k), ser(x)]));
    if (Array.isArray(v) || v instanceof Set || ArrayBuffer.isView(v)) return Array.from(v, ser);
    const out = {}; for (const k of Object.keys(v)) out[k] = ser(v[k]); return out;
  };
  const describe = e => {
    if (!(e instanceof Error)) return 'Thrown: ' + String(e);
    const prefix = ${'${PREFIX}'}, userLines = ${'${USERLINES}'};
    let where = '';
    for (const frame of String(e.stack || '').split('\\n')) {
      const m = /\\.js:(\\d+):\\d+\\)?$/.exec(frame.trim());
      if (m && Number(m[1]) > prefix && Number(m[1]) <= prefix + userLines) { where = ' (line ' + (Number(m[1]) - prefix) + ')'; break; }
    }
    return e.name + ': ' + e.message + where;
  };
  // assembled by hand so nothing the player returns (toJSON etc.) can add or replace fields
  const emit = (i, ok, payload, printed) =>
    write(1, mark + '{"i":' + i + ',"ok":' + ok + ',' + payload + ',"stdout":' + stringify(String(printed).slice(-2000)) + '}\\n');
  return find => {
    if (used) return;
    used = true;
    const fn = find();
    if (typeof fn !== 'function') {
      write(1, mark + stringify({ fatal: 'Function ${name} was not found. Keep the function name from the starter code.' }) + '\\n');
      return;
    }
    tests.forEach((raw, i) => {
      let captured = '';
      const capture = (...parts) => { captured += parts.map(p => (typeof p === 'string' ? p : util.inspect(p))).join(' ') + '\\n'; };
      console.log = console.info = console.debug = capture;
      stdout.write = chunk => { captured += String(chunk); return true; };
      let ok = true;
      let payload;
      try {
        const args = raw.map((v, k) => convert(types[k], v));
        const started = hr();
        const result = fn(...args);
        const ms = Number(hr() - started) / 1e6;
        let value;
        try { value = stringify(ser(result)); } catch (e) { value = 'null'; }
        payload = '"ms":' + ms + ',"value":' + (value === undefined ? 'null' : value);
      } catch (e) {
        ok = false;
        payload = '"error":' + stringify(describe(e));
      } finally {
        console.log = original.log; console.info = original.info; console.debug = original.debug; stdout.write = original.write;
      }
      emit(i, ok, payload, captured);
    });
  };
})();
function ListNode(val, next) { this.val = val === undefined ? 0 : val; this.next = next === undefined ? null : next; }
function TreeNode(val, left, right) { this.val = val === undefined ? 0 : val; this.left = left === undefined ? null : left; this.right = right === undefined ? null : right; }
{
`
    .replace('${PREFIX}', String(prefixFrom()))
    .replace('${USERLINES}', String(userLinesFrom()));
}

function buildJavaScript(signature: ProblemSignature, code: string): BuiltProgram {
  const userLines = countLines(code) + 1;
  // the boot text has a fixed line count, so measure it once with placeholder numbers
  const prefixLines = countLines(jsBoot(signature, () => 0, () => 0));
  const boot = jsBoot(signature, () => userLines, () => prefixLines);
  const lookups = candidateNames(signature)
    .map(n => `(typeof ${n} === 'function' ? ${n} : null)`)
    .join(' || ');
  const finder = `
;__cb_run(() => {
  const direct = ${lookups};
  if (direct) return direct;
  if (typeof Solution === 'function') {
    const inst = new Solution();
    for (const n of ${JSON.stringify(candidateNames(signature))}) if (typeof inst[n] === 'function') return inst[n].bind(inst);
  }
  return null;
});
}
`;
  return { source: `${boot}${code}\n${finder}`, prefixLines };
}

// ---------------------------------------------------------------- java

const JAVA_PRELUDE = `import java.util.*;
import java.util.function.*;
import java.util.stream.*;
import java.io.*;
`;

const JAVA_CONVERTERS: Record<ValueType, string> = {
  int: '__CB.toInt',
  long: '__CB.toLong',
  double: '__CB.toDouble',
  bool: '__CB.toBool',
  string: '__CB.toStr',
  'int[]': '__CB.toIntArr',
  'double[]': '__CB.toDoubleArr',
  'bool[]': '__CB.toBoolArr',
  'string[]': '__CB.toStrArr',
  'int[][]': '__CB.toIntMat',
  'string[][]': '__CB.toStrMat',
  'char[][]': '__CB.toCharMat',
  ListNode: '__CB.toList',
  TreeNode: '__CB.toTree',
};

const JAVA_LIST_NODE = `
class ListNode {
    int val; ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}
`;

const JAVA_TREE_NODE = `
class TreeNode {
    int val; TreeNode left; TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}
`;

const JAVA_HELPERS = `
final class __CB {
    static String src; static int pos;
    static Object parse(String s) { src = s; pos = 0; return val(); }
    static void ws() { while (pos < src.length() && Character.isWhitespace(src.charAt(pos))) pos++; }
    static Object val() {
        ws();
        char c = src.charAt(pos);
        if (c == '{') {
            pos++; Map<String, Object> m = new LinkedHashMap<>(); ws();
            if (src.charAt(pos) == '}') { pos++; return m; }
            while (true) { ws(); String k = (String) val(); ws(); pos++; m.put(k, val()); ws(); if (src.charAt(pos++) == '}') return m; }
        }
        if (c == '[') {
            pos++; List<Object> l = new ArrayList<>(); ws();
            if (src.charAt(pos) == ']') { pos++; return l; }
            while (true) { l.add(val()); ws(); if (src.charAt(pos++) == ']') return l; }
        }
        if (c == '"') {
            pos++; StringBuilder sb = new StringBuilder();
            while (true) {
                char d = src.charAt(pos++);
                if (d == '"') return sb.toString();
                if (d != '\\\\') { sb.append(d); continue; }
                char e = src.charAt(pos++);
                switch (e) {
                    case 'n': sb.append('\\n'); break;
                    case 't': sb.append('\\t'); break;
                    case 'r': sb.append('\\r'); break;
                    case 'b': sb.append('\\b'); break;
                    case 'f': sb.append('\\f'); break;
                    case 'u': sb.append((char) Integer.parseInt(src.substring(pos, pos + 4), 16)); pos += 4; break;
                    default: sb.append(e);
                }
            }
        }
        if (src.startsWith("true", pos)) { pos += 4; return Boolean.TRUE; }
        if (src.startsWith("false", pos)) { pos += 5; return Boolean.FALSE; }
        if (src.startsWith("null", pos)) { pos += 4; return null; }
        int start = pos;
        while (pos < src.length() && "+-0123456789.eE".indexOf(src.charAt(pos)) >= 0) pos++;
        String n = src.substring(start, pos);
        if (n.contains(".") || n.contains("e") || n.contains("E")) return Double.parseDouble(n);
        return Long.parseLong(n);
    }
    static List<?> L(Object o) { return (List<?>) o; }
    static int toInt(Object o) { return ((Number) o).intValue(); }
    static long toLong(Object o) { return ((Number) o).longValue(); }
    static double toDouble(Object o) { return ((Number) o).doubleValue(); }
    static boolean toBool(Object o) { return (Boolean) o; }
    static String toStr(Object o) { return (String) o; }
    static int[] toIntArr(Object o) { List<?> l = L(o); int[] a = new int[l.size()]; for (int i = 0; i < a.length; i++) a[i] = toInt(l.get(i)); return a; }
    static double[] toDoubleArr(Object o) { List<?> l = L(o); double[] a = new double[l.size()]; for (int i = 0; i < a.length; i++) a[i] = toDouble(l.get(i)); return a; }
    static boolean[] toBoolArr(Object o) { List<?> l = L(o); boolean[] a = new boolean[l.size()]; for (int i = 0; i < a.length; i++) a[i] = toBool(l.get(i)); return a; }
    static String[] toStrArr(Object o) { List<?> l = L(o); String[] a = new String[l.size()]; for (int i = 0; i < a.length; i++) a[i] = toStr(l.get(i)); return a; }
    static int[][] toIntMat(Object o) { List<?> l = L(o); int[][] a = new int[l.size()][]; for (int i = 0; i < a.length; i++) a[i] = toIntArr(l.get(i)); return a; }
    static List<List<String>> toStrMat(Object o) { List<List<String>> r = new ArrayList<>(); for (Object row : L(o)) { List<String> x = new ArrayList<>(); for (Object s : L(row)) x.add((String) s); r.add(x); } return r; }
    static char[][] toCharMat(Object o) { List<?> l = L(o); char[][] a = new char[l.size()][]; for (int i = 0; i < a.length; i++) { List<?> row = L(l.get(i)); a[i] = new char[row.size()]; for (int j = 0; j < a[i].length; j++) a[i][j] = ((String) row.get(j)).charAt(0); } return a; }
    static ListNode toList(Object o) { ListNode d = new ListNode(0), c = d; for (Object x : L(o)) { c.next = new ListNode(toInt(x)); c = c.next; } return d.next; }
    static TreeNode toTree(Object o) {
        List<?> l = L(o);
        if (l.isEmpty() || l.get(0) == null) return null;
        TreeNode root = new TreeNode(toInt(l.get(0)));
        ArrayDeque<TreeNode> q = new ArrayDeque<>(); q.add(root); int i = 1;
        while (!q.isEmpty() && i < l.size()) {
            TreeNode n = q.poll();
            if (i < l.size() && l.get(i) != null) { n.left = new TreeNode(toInt(l.get(i))); q.add(n.left); } i++;
            if (i < l.size() && l.get(i) != null) { n.right = new TreeNode(toInt(l.get(i))); q.add(n.right); } i++;
        }
        return root;
    }
    static void str(String s, StringBuilder sb) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\\\') sb.append('\\\\').append(c);
            else if (c == '\\n') sb.append("\\\\n");
            else if (c == '\\r') sb.append("\\\\r");
            else if (c == '\\t') sb.append("\\\\t");
            else if (c < 0x20) sb.append(String.format("\\\\u%04x", (int) c));
            else sb.append(c);
        }
        sb.append('"');
    }
    static void ser(Object v, StringBuilder sb) {
        if (v == null) { sb.append("null"); return; }
        if (v instanceof String) { str((String) v, sb); return; }
        if (v instanceof Character) { str(String.valueOf(v), sb); return; }
        if (v instanceof Boolean) { sb.append(v); return; }
        if (v instanceof Double || v instanceof Float) { double d = ((Number) v).doubleValue(); sb.append(Double.isFinite(d) ? String.valueOf(d) : "null"); return; }
        if (v instanceof Number) { sb.append(v); return; }
        if (v instanceof int[]) { int[] a = (int[]) v; sb.append('['); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); sb.append(a[i]); } sb.append(']'); return; }
        if (v instanceof long[]) { long[] a = (long[]) v; sb.append('['); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); sb.append(a[i]); } sb.append(']'); return; }
        if (v instanceof double[]) { double[] a = (double[]) v; sb.append('['); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); ser(a[i], sb); } sb.append(']'); return; }
        if (v instanceof boolean[]) { boolean[] a = (boolean[]) v; sb.append('['); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); sb.append(a[i]); } sb.append(']'); return; }
        if (v instanceof char[]) { char[] a = (char[]) v; sb.append('['); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); str(String.valueOf(a[i]), sb); } sb.append(']'); return; }
        if (v instanceof Object[]) { Object[] a = (Object[]) v; sb.append('['); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); ser(a[i], sb); } sb.append(']'); return; }
        if (v instanceof Iterable) { sb.append('['); boolean first = true; for (Object x : (Iterable<?>) v) { if (!first) sb.append(','); first = false; ser(x, sb); } sb.append(']'); return; }
        if (v instanceof Map) { sb.append('{'); boolean first = true; for (Map.Entry<?, ?> e : ((Map<?, ?>) v).entrySet()) { if (!first) sb.append(','); first = false; str(String.valueOf(e.getKey()), sb); sb.append(':'); ser(e.getValue(), sb); } sb.append('}'); return; }
        if (v instanceof ListNode) { sb.append('['); ListNode n = (ListNode) v; int c = 0; while (n != null && c < 200000) { if (c++ > 0) sb.append(','); sb.append(n.val); n = n.next; } sb.append(']'); return; }
        if (v instanceof TreeNode) {
            List<String> out = new ArrayList<>(); ArrayDeque<TreeNode> q = new ArrayDeque<>(); List<TreeNode> level = new ArrayList<>(); level.add((TreeNode) v);
            int idx = 0;
            while (idx < level.size() && out.size() < 200000) { TreeNode n = level.get(idx++); if (n == null) { out.add("null"); continue; } out.add(String.valueOf(n.val)); level.add(n.left); level.add(n.right); }
            int end = out.size(); while (end > 0 && out.get(end - 1).equals("null")) end--;
            sb.append('[').append(String.join(",", out.subList(0, end))).append(']'); return;
        }
        str(String.valueOf(v), sb);
    }
    static String err(Throwable e, int prefix, int userLines) {
        String where = "";
        for (StackTraceElement f : e.getStackTrace()) {
            int ln = f.getLineNumber();
            if ("Main.java".equals(f.getFileName()) && ln > prefix && ln <= prefix + userLines) { where = " (line " + (ln - prefix) + ")"; break; }
        }
        String msg = e.getMessage();
        return e.getClass().getSimpleName() + (msg == null ? "" : ": " + msg) + where;
    }
}
`;

function buildJava(signature: ProblemSignature, code: string): BuiltProgram {
  const prefixLines = countLines(JAVA_PRELUDE);
  // the file is Main.java, so the player's class can't also be public
  const user = code.replace(/^(\s*)public\s+(final\s+)?class\s+/gm, '$1$2class ');
  const userLines = countLines(user) + 1;
  const name = functionNameFor(signature, 'java');
  // provide ListNode / TreeNode unless the player declared their own (comments don't count)
  const uncommented = user.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const nodes =
    (/\bclass\s+ListNode\b/.test(uncommented) ? '' : JAVA_LIST_NODE) +
    (/\bclass\s+TreeNode\b/.test(uncommented) ? '' : JAVA_TREE_NODE);
  const decls = signature.params
    .map((p, i) => `${JAVA_TYPES[p.type]} a${i} = ${JAVA_CONVERTERS[p.type]}(args.get(${i}));`)
    .join(' ');
  const call = signature.params.map((_p, i) => `a${i}`).join(', ');
  const main = `
public class Main {
    public static void main(String[] argv) throws Exception {
        Thread t = new Thread(null, () -> {
            try { run(); } catch (Exception e) { throw new RuntimeException(e); }
        }, "main", 512L * 1024 * 1024);
        t.start();
        t.join();
    }
    static void run() throws Exception {
        String input = new String(System.in.readAllBytes(), "UTF-8");
        Map<?, ?> data = (Map<?, ?>) __CB.parse(input);
        String mark = (String) data.get("nonce");
        List<?> tests = (List<?>) data.get("tests");
        PrintStream real = System.out;
        for (int i = 0; i < tests.size(); i++) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            System.setOut(new PrintStream(buf, true, "UTF-8"));
            StringBuilder sb = new StringBuilder("{\\"i\\":").append(i);
            try {
                List<?> args = (List<?>) tests.get(i);
                ${decls}
                Solution solution = new Solution();
                long started = System.nanoTime();
                Object result = solution.${name}(${call});
                double ms = (System.nanoTime() - started) / 1e6;
                System.setOut(real);
                sb.append(",\\"ok\\":true,\\"ms\\":").append(ms).append(",\\"value\\":");
                __CB.ser(result, sb);
            } catch (Throwable e) {
                System.setOut(real);
                sb.append(",\\"ok\\":false,\\"error\\":");
                __CB.str(__CB.err(e, ${prefixLines}, ${userLines}), sb);
            }
            String printed = buf.toString("UTF-8");
            if (printed.length() > 2000) printed = printed.substring(printed.length() - 2000);
            sb.append(",\\"stdout\\":");
            __CB.str(printed, sb);
            sb.append('}');
            real.println(mark + sb);
            real.flush();
        }
    }
}
`;
  return {
    source: `${JAVA_PRELUDE}${user}\n${nodes}${JAVA_HELPERS}${main}`,
    prefixLines,
  };
}

// ---------------------------------------------------------------- c++

const CPP_PRELUDE = `#include <bits/stdc++.h>
using namespace std;
`;

const CPP_LIST_NODE = `struct ListNode {
    int val; ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};
`;

const CPP_TREE_NODE = `struct TreeNode {
    int val; TreeNode *left; TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};
`;

/*
 * A small JSON reader, converters from JSON to each parameter type and
 * serializers for whatever the player's method returns. Non-template overloads
 * come first so the container templates can find them during instantiation.
 */
const CPP_HELPERS = String.raw`
namespace __cb {
struct J {
    int k = 0; // 0 null, 1 bool, 2 int, 3 double, 4 string, 5 array, 6 object
    bool b = false; long long i = 0; double d = 0; std::string s;
    std::vector<J> a; std::vector<std::pair<std::string, J>> o;
    const J& at(const std::string& key) const {
        for (const auto& p : o) if (p.first == key) return p.second;
        throw std::runtime_error("missing key " + key);
    }
};
struct Reader {
    const std::string& t; size_t p = 0;
    explicit Reader(const std::string& text) : t(text) {}
    char peek() const { if (p >= t.size()) throw std::runtime_error("unexpected end of input"); return t[p]; }
    char next() { char c = peek(); p++; return c; }
    void ws() { while (p < t.size() && std::isspace((unsigned char) t[p])) p++; }
    static void utf8(std::string& out, unsigned cp) {
        if (cp < 0x80) out += (char) cp;
        else if (cp < 0x800) { out += (char) (0xC0 | (cp >> 6)); out += (char) (0x80 | (cp & 0x3F)); }
        else if (cp < 0x10000) { out += (char) (0xE0 | (cp >> 12)); out += (char) (0x80 | ((cp >> 6) & 0x3F)); out += (char) (0x80 | (cp & 0x3F)); }
        else { out += (char) (0xF0 | (cp >> 18)); out += (char) (0x80 | ((cp >> 12) & 0x3F)); out += (char) (0x80 | ((cp >> 6) & 0x3F)); out += (char) (0x80 | (cp & 0x3F)); }
    }
    unsigned hex4() { unsigned v = (unsigned) std::stoul(t.substr(p, 4), nullptr, 16); p += 4; return v; }
    J val() {
        ws();
        J j;
        char c = peek();
        if (c == '{') {
            p++; j.k = 6; ws();
            if (peek() == '}') { p++; return j; }
            while (true) {
                ws(); J key = val(); ws(); next();
                J item = val(); j.o.emplace_back(key.s, item); ws();
                if (next() == '}') return j;
            }
        }
        if (c == '[') {
            p++; j.k = 5; ws();
            if (peek() == ']') { p++; return j; }
            while (true) { j.a.push_back(val()); ws(); if (next() == ']') return j; }
        }
        if (c == '"') {
            p++; j.k = 4;
            while (true) {
                char d = next();
                if (d == '"') return j;
                if (d != '\\') { j.s += d; continue; }
                char e = next();
                switch (e) {
                    case 'n': j.s += '\n'; break;
                    case 't': j.s += '\t'; break;
                    case 'r': j.s += '\r'; break;
                    case 'b': j.s += '\b'; break;
                    case 'f': j.s += '\f'; break;
                    case 'u': {
                        unsigned cp = hex4();
                        if (cp >= 0xD800 && cp < 0xDC00 && t.compare(p, 2, "\\u") == 0) {
                            p += 2; unsigned lo = hex4();
                            cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
                        }
                        utf8(j.s, cp);
                        break;
                    }
                    default: j.s += e;
                }
            }
        }
        if (t.compare(p, 4, "true") == 0) { p += 4; j.k = 1; j.b = true; return j; }
        if (t.compare(p, 5, "false") == 0) { p += 5; j.k = 1; return j; }
        if (t.compare(p, 4, "null") == 0) { p += 4; return j; }
        size_t start = p;
        while (p < t.size() && t[p] != '\0' && std::strchr("+-0123456789.eE", t[p]) != nullptr) p++;
        std::string n = t.substr(start, p - start);
        if (n.empty()) throw std::runtime_error("bad JSON");
        if (n.find_first_of(".eE") != std::string::npos) { j.k = 3; j.d = std::stod(n); }
        else { j.k = 2; j.i = std::stoll(n); j.d = (double) j.i; }
        return j;
    }
};

inline void cv(const J& j, int& x) { x = (int) j.i; }
inline void cv(const J& j, long& x) { x = (long) j.i; }
inline void cv(const J& j, long long& x) { x = j.i; }
inline void cv(const J& j, double& x) { x = j.d; }
inline void cv(const J& j, bool& x) { x = j.b; }
inline void cv(const J& j, char& x) { x = j.s.empty() ? '\0' : j.s[0]; }
inline void cv(const J& j, std::string& x) { x = j.s; }
inline void cv(const J& j, ListNode*& x) {
    ListNode head(0); ListNode* tail = &head;
    for (const J& e : j.a) { tail->next = new ListNode((int) e.i); tail = tail->next; }
    x = head.next;
}
inline void cv(const J& j, TreeNode*& x) {
    x = nullptr;
    if (j.a.empty() || j.a[0].k == 0) return;
    x = new TreeNode((int) j.a[0].i);
    std::deque<TreeNode*> q{x}; size_t i = 1;
    while (!q.empty() && i < j.a.size()) {
        TreeNode* n = q.front(); q.pop_front();
        if (i < j.a.size() && j.a[i].k != 0) { n->left = new TreeNode((int) j.a[i].i); q.push_back(n->left); } i++;
        if (i < j.a.size() && j.a[i].k != 0) { n->right = new TreeNode((int) j.a[i].i); q.push_back(n->right); } i++;
    }
}
template <class T> void cv(const J& j, std::vector<T>& x) {
    x.clear();
    for (const J& e : j.a) { T v{}; cv(e, v); x.push_back(v); }
}

inline void str(std::string& o, const std::string& s) {
    o += '"';
    for (unsigned char c : s) {
        if (c == '"' || c == '\\') { o += '\\'; o += (char) c; }
        else if (c == '\n') o += "\\n";
        else if (c == '\r') o += "\\r";
        else if (c == '\t') o += "\\t";
        else if (c < 0x20) { char buf[8]; std::snprintf(buf, sizeof buf, "\\u%04x", c); o += buf; }
        else o += (char) c;
    }
    o += '"';
}
inline void ser(std::string& o, bool v) { o += v ? "true" : "false"; }
inline void ser(std::string& o, char v) { str(o, std::string(1, v)); }
inline void ser(std::string& o, short v) { o += std::to_string(v); }
inline void ser(std::string& o, int v) { o += std::to_string(v); }
inline void ser(std::string& o, long v) { o += std::to_string(v); }
inline void ser(std::string& o, long long v) { o += std::to_string(v); }
inline void ser(std::string& o, unsigned v) { o += std::to_string(v); }
inline void ser(std::string& o, unsigned long v) { o += std::to_string(v); }
inline void ser(std::string& o, unsigned long long v) { o += std::to_string(v); }
inline void ser(std::string& o, double v) {
    if (!std::isfinite(v)) { o += "null"; return; }
    char buf[40]; std::snprintf(buf, sizeof buf, "%.17g", v); o += buf;
}
inline void ser(std::string& o, float v) { ser(o, (double) v); }
inline void ser(std::string& o, const std::string& v) { str(o, v); }
inline void ser(std::string& o, const char* v) { str(o, v ? std::string(v) : std::string()); }
inline void ser(std::string& o, std::nullptr_t) { o += "null"; }
inline void ser(std::string& o, const ListNode* v) {
    o += '['; int c = 0;
    while (v != nullptr && c < 200000) { if (c++ > 0) o += ','; o += std::to_string(v->val); v = v->next; }
    o += ']';
}
inline void ser(std::string& o, const TreeNode* v) {
    std::vector<const TreeNode*> level{v}; std::vector<std::string> out; size_t idx = 0;
    while (idx < level.size() && out.size() < 200000) {
        const TreeNode* n = level[idx++];
        if (n == nullptr) { out.push_back("null"); continue; }
        out.push_back(std::to_string(n->val)); level.push_back(n->left); level.push_back(n->right);
    }
    size_t end = out.size(); while (end > 0 && out[end - 1] == "null") end--;
    o += '[';
    for (size_t k = 0; k < end; k++) { if (k > 0) o += ','; o += out[k]; }
    o += ']';
}
inline void ser(std::string& o, const std::vector<bool>& v) {
    o += '[';
    for (size_t k = 0; k < v.size(); k++) { if (k > 0) o += ','; o += v[k] ? "true" : "false"; }
    o += ']';
}
template <class A, class B> void ser(std::string& o, const std::pair<A, B>& v);
template <class T> void ser(std::string& o, const std::vector<T>& v);
template <class T> void seq(std::string& o, const T& v) {
    o += '['; bool first = true;
    for (const auto& x : v) { if (!first) o += ','; first = false; ser(o, x); }
    o += ']';
}
template <class T> void ser(std::string& o, const std::vector<T>& v) { seq(o, v); }
template <class T> void ser(std::string& o, const std::deque<T>& v) { seq(o, v); }
template <class T> void ser(std::string& o, const std::list<T>& v) { seq(o, v); }
template <class T> void ser(std::string& o, const std::set<T>& v) { seq(o, v); }
template <class T, size_t N> void ser(std::string& o, const std::array<T, N>& v) { seq(o, v); }
template <class A, class B> void ser(std::string& o, const std::pair<A, B>& v) {
    o += '['; ser(o, v.first); o += ','; ser(o, v.second); o += ']';
}
} // namespace __cb
`;

/** Every argument is a local of its starter-code type (the reference dropped). */
const CPP_LOCAL_TYPES: Record<ValueType, string> = {
  int: 'int',
  long: 'long long',
  double: 'double',
  bool: 'bool',
  string: 'std::string',
  'int[]': 'std::vector<int>',
  'double[]': 'std::vector<double>',
  'bool[]': 'std::vector<bool>',
  'string[]': 'std::vector<std::string>',
  'int[][]': 'std::vector<std::vector<int>>',
  'string[][]': 'std::vector<std::vector<std::string>>',
  'char[][]': 'std::vector<std::vector<char>>',
  ListNode: 'ListNode*',
  TreeNode: 'TreeNode*',
};

function stripCComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function buildCpp(signature: ProblemSignature, code: string): BuiltProgram {
  const uncommented = stripCComments(code);
  // provide ListNode / TreeNode unless the player declared their own
  const nodes =
    (/\b(class|struct)\s+ListNode\b/.test(uncommented) ? '' : CPP_LIST_NODE) +
    (/\b(class|struct)\s+TreeNode\b/.test(uncommented) ? '' : CPP_TREE_NODE);
  const before = `${CPP_PRELUDE}${nodes}`;
  const prefixLines = countLines(before);
  const name = functionNameFor(signature, 'cpp');
  // without the class and method the program can't compile; report it the way the other languages do
  const found = /\b(class|struct)\s+Solution\b/.test(uncommented) && new RegExp(`\\b${name}\\s*\\(`).test(uncommented);
  const missing = `Function ${name} was not found. Keep the Solution class and the method name from the starter code.`;

  const decls = signature.params
    .map((p, i) => `${CPP_LOCAL_TYPES[p.type]} a${i}{}; __cb::cv(args.at(${i}), a${i});`)
    .join('\n                ');
  const call = signature.params.map((_p, i) => `a${i}`).join(', ');
  const body = found
    ? String.raw`
    std::streambuf* real = std::cout.rdbuf();
    for (size_t i = 0; i < tests.a.size(); i++) {
        std::ostringstream buf;
        std::cout.rdbuf(buf.rdbuf());
        std::string line = "{\"i\":" + std::to_string(i);
        try {
            const std::vector<__cb::J>& args = tests.a[i].a;
            {
                ${decls}
                Solution solution;
                auto started = std::chrono::steady_clock::now();
                auto result = solution.${name}(${call});
                double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - started).count();
                std::cout.rdbuf(real);
                line += ",\"ok\":true,\"ms\":";
                __cb::ser(line, ms);
                line += ",\"value\":";
                __cb::ser(line, result);
            }
        } catch (const std::exception& e) {
            std::cout.rdbuf(real);
            line += ",\"ok\":false,\"error\":";
            __cb::str(line, std::string("Exception: ") + e.what());
        } catch (...) {
            std::cout.rdbuf(real);
            line += ",\"ok\":false,\"error\":";
            __cb::str(line, "Unknown exception thrown");
        }
        std::string printed = buf.str();
        if (printed.size() > 2000) printed = printed.substr(printed.size() - 2000);
        line += ",\"stdout\":";
        __cb::str(line, printed);
        line += '}';
        std::cout << mark << line << '\n' << std::flush;
    }`
    : String.raw`
    (void) tests;
    std::string line = "{\"fatal\":";
    __cb::str(line, ${JSON.stringify(missing)});
    std::cout << mark << line << "}\n" << std::flush;`;

  const main = String.raw`
int main() {
    std::string input((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());
    __cb::J data;
    try { __cb::Reader reader(input); data = reader.val(); } catch (...) { return 3; }
    const std::string mark = data.at("nonce").s;
    const __cb::J& tests = data.at("tests");${body}
    return 0;
}
`;
  return { source: `${before}${code}\n${CPP_HELPERS}${main}`, prefixLines };
}
