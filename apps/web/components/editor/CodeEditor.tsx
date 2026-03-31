"use client";

import { TestCaseResult } from '@codebattle/shared';
import Editor from '@monaco-editor/react';
import { useEffect, useMemo } from 'react';
import { socket } from '../../lib/socket';
import { useBattleState, EditorLanguage } from '../../lib/state';

const languages: { label: string; value: EditorLanguage }[] = [
  { label: 'Python', value: 'python' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'Java', value: 'java' }
];

interface CodeEditorProps {
  matchId: string;
}

export function CodeEditor({ matchId }: CodeEditorProps): JSX.Element {
  const { language, code, setLanguage, setCode, setResults, setStatus } = useBattleState();

  const options = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily: 'JetBrains Mono',
      smoothScrolling: true
    }),
    []
  );

  const handleRun = (): void => {
    setStatus('running');
    socket.emit('battle:run', { matchId, userId: 'me', code, language });
  };

  const handleSubmit = (): void => {
    setStatus('submitted');
    socket.emit('battle:submit', { matchId, userId: 'me', code, language });
  };

  useEffect(() => {
    const handleRunResult = (payload: { results: TestCaseResult[] }) => {
      setResults(payload.results);
      setStatus('idle');
    };

    const handleSubmitResult = (payload: {
      passedTests: number;
      totalTests: number;
      status: string;
      runtimeMs?: number;
      memoryKb?: number;
    }) => {
      setResults([
        {
          input: 'summary',
          expected: `${payload.passedTests}/${payload.totalTests}`,
          output: payload.status,
          passed: payload.status === 'ACCEPTED',
          runtimeMs: payload.runtimeMs,
          memoryKb: payload.memoryKb
        }
      ]);
    };

    socket.on('run:result', handleRunResult);
    socket.on('submission:result', handleSubmitResult);

    return () => {
      socket.off('run:result', handleRunResult);
      socket.off('submission:result', handleSubmitResult);
    };
  }, [setResults, setStatus]);

  return (
    <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {languages.map(lang => (
            <button
              key={lang.value}
              className={`rounded-md px-3 py-1 text-sm ${language === lang.value ? 'bg-primary text-white' : 'border border-slate-700 text-slate-200'}`}
              onClick={() => setLanguage(lang.value)}
              type="button"
            >
              {lang.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="rounded-md border border-slate-600 px-3 py-1 text-sm" onClick={handleRun} type="button">
            Run
          </button>
          <button className="rounded-md bg-success px-3 py-1 text-sm font-medium text-black" onClick={handleSubmit} type="button">
            Submit
          </button>
        </div>
      </div>
      <Editor height="520px" language={language === 'javascript' ? 'typescript' : language} options={options} value={code} onChange={value => setCode(value ?? '')} />
    </div>
  );
}
