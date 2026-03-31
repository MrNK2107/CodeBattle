import { TestCaseResult } from '@codebattle/shared';

interface TestResultsProps {
  results: TestCaseResult[];
}

export function TestResults({ results }: TestResultsProps): JSX.Element {
  if (!results.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900 p-4 text-sm text-slate-400">
        Run code to see results.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-3">
      <p className="text-sm text-slate-300">Results</p>
      <div className="divide-y divide-slate-800">
        {results.map((result, idx) => (
          <div key={`${result.input}-${idx}`} className="flex items-center justify-between py-2">
            <div>
              <p className="text-xs uppercase text-slate-400">Input</p>
              <p className="font-mono text-sm text-white">{result.input}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-slate-400">Expected</p>
              <p className="font-mono text-sm text-white">{result.expected}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-md px-2 py-1 text-xs ${result.passed ? 'bg-success text-black' : 'bg-danger text-white'}`}>
                {result.passed ? 'Pass' : 'Fail'}
              </span>
              {result.runtimeMs ? <span className="text-xs text-slate-400">{result.runtimeMs} ms</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
