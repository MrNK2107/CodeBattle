"use client";

import type { RunResult, TestCaseResult } from '@codebattle/shared';
import { useEffect, useState } from 'react';

import { VERDICT_LABEL, formatMs } from '@/lib/format';

const STATUS_DOT: Record<TestCaseResult['status'], string> = {
  passed: 'bg-pass',
  wrong: 'bg-fail',
  error: 'bg-fail',
  timeout: 'bg-fail',
  not_run: 'bg-faint',
};

const STATUS_TEXT: Record<TestCaseResult['status'], string> = {
  passed: 'Passed',
  wrong: 'Wrong answer',
  error: 'Error',
  timeout: 'Time limit exceeded',
  not_run: 'Not run',
};

export function RunResults({ result, emptyHint }: { result: RunResult | null; emptyHint: string }): JSX.Element {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    // jump to the first failing case after each run
    if (!result) return;
    const firstFail = result.results.findIndex(r => !r.passed);
    setSelected(firstFail === -1 ? 0 : firstFail);
  }, [result]);

  if (!result) {
    return <p className="px-4 py-6 text-sm text-muted">{emptyHint}</p>;
  }

  const ok = result.verdict === 'ACCEPTED';
  const current = result.results[selected];

  return (
    <div className="space-y-3 px-4 py-3" aria-live="polite">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className={`font-display text-lg font-semibold ${ok ? 'text-pass' : 'text-fail'}`}>{VERDICT_LABEL[result.verdict]}</p>
        {result.total > 0 ? (
          <p className="text-sm text-muted">
            {result.passed} of {result.total} tests passed
          </p>
        ) : null}
      </div>

      {result.message ? (
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-fail/10 p-3 font-mono text-xs text-fail">{result.message}</pre>
      ) : null}

      {result.results.length ? (
        <>
          <div role="tablist" aria-label="Test cases" className="flex flex-wrap gap-1.5">
            {result.results.map((r, i) => (
              <button
                key={i}
                role="tab"
                type="button"
                aria-selected={i === selected}
                onClick={() => setSelected(i)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
                  i === selected ? 'bg-raised text-text' : 'text-muted hover:text-text'
                }`}
              >
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[r.status]}`} />
                Case {r.index + 1}
                <span className="sr-only">{STATUS_TEXT[r.status]}</span>
              </button>
            ))}
          </div>
          {current ? <CaseDetail result={current} /> : null}
        </>
      ) : null}
    </div>
  );
}

export function CaseDetail({ result }: { result: TestCaseResult }): JSX.Element {
  return (
    <div className="space-y-2 text-sm">
      <p className={`text-xs font-semibold ${result.passed ? 'text-pass' : result.status === 'not_run' ? 'text-muted' : 'text-fail'}`}>
        {STATUS_TEXT[result.status]}
        {result.runtimeMs !== undefined ? <span className="font-normal text-faint"> in {formatMs(result.runtimeMs)}</span> : null}
      </p>
      <Field label="Input" value={result.input} />
      <Field label="Expected" value={result.expected} />
      {result.actual !== undefined ? <Field label="Your output" value={result.actual} tone={result.passed ? undefined : 'fail'} /> : null}
      {result.error ? <Field label="Error" value={result.error} tone="fail" /> : null}
      {result.stdout ? <Field label="Printed" value={result.stdout} /> : null}
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'fail' }): JSX.Element {
  return (
    <div>
      <p className="mb-1 text-xs text-faint">{label}</p>
      <pre
        className={`max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-well px-3 py-2 font-mono text-[13px] ${
          tone === 'fail' ? 'text-fail' : 'text-text'
        }`}
      >
        {value}
      </pre>
    </div>
  );
}
