import type { RunResult } from '@codebattle/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CaseDetail, RunResults } from './RunResults';

// The judge appends a readable crash line to stderr (services/runners.ts crashDescription),
// so the "Error" field and the verdict message carry multi-line text from untrusted programs.
const SEGV = 'Program exited unexpectedly\nSegmentation fault (SIGSEGV): invalid memory access or a stack overflow from too-deep recursion';
const FPE = 'Arithmetic error (SIGFPE): integer division by zero or overflow';
const HOSTILE = '<script>alert(1)</script><img src=x onerror=alert(2)>&amp;';
const LONG_TOKEN = 'x'.repeat(5000);

function crashResult(error: string, message?: string): RunResult {
  return {
    verdict: 'RUNTIME_ERROR',
    passed: 0,
    total: 1,
    message,
    results: [{ index: 0, input: '5', expected: '5', status: 'error', passed: false, error }],
  };
}

function preBlocks(html: string): { className: string; body: string }[] {
  return [...html.matchAll(/<pre class="([^"]*)">([\s\S]*?)<\/pre>/g)].map(m => ({ className: m[1], body: m[2] }));
}

describe('crash messages in the match UI', () => {
  it('keeps the line break between the generic text and the signal explanation', () => {
    const html = renderToStaticMarkup(<RunResults result={crashResult(SEGV)} emptyHint="" />);
    const err = preBlocks(html).find(p => p.body.includes('SIGSEGV'));
    expect(err).toBeDefined();
    // newline survives as a real newline inside a pre-wrap block (no <br>, no collapsed whitespace)
    expect(err!.body).toBe(SEGV);
    expect(err!.className).toContain('whitespace-pre-wrap');
    expect(html).toContain('Runtime error');
  });

  it('renders SIGFPE in the verdict message block', () => {
    const html = renderToStaticMarkup(<RunResults result={crashResult(FPE, `Case 1 crashed\n${FPE}`)} emptyHint="" />);
    expect(html).toContain('Case 1 crashed\nArithmetic error (SIGFPE)');
  });

  it('escapes program output instead of injecting markup', () => {
    const html = renderToStaticMarkup(<RunResults result={crashResult(`${HOSTILE}\n${FPE}`, HOSTILE)} emptyHint="" />);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&amp;amp;');
  });

  it('contains a long unbroken line (scroll + break-words, height capped)', () => {
    const html = renderToStaticMarkup(<RunResults result={crashResult(LONG_TOKEN, LONG_TOKEN)} emptyHint="" />);
    const blocks = preBlocks(html).filter(p => p.body.startsWith('xxx'));
    expect(blocks).toHaveLength(2);
    for (const b of blocks) {
      expect(b.className).toMatch(/\boverflow-auto\b/);
      expect(b.className).toMatch(/\bbreak-words\b/);
      expect(b.className).toMatch(/\bmax-h-\d+/);
    }
  });

  it('CaseDetail (used by the battle room) shows the crash text under "Error"', () => {
    const html = renderToStaticMarkup(
      <CaseDetail result={{ index: 2, input: '1', expected: '1', status: 'error', passed: false, error: SEGV }} />,
    );
    expect(html).toContain('>Error<');
    expect(html).toContain(SEGV);
  });
});
