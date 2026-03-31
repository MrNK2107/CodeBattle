"use client";

import Editor from '@monaco-editor/react';
import { useMemo } from 'react';

interface OpponentViewProps {
  matchId: string;
}

export function OpponentView({ matchId }: OpponentViewProps): JSX.Element {
  const options = useMemo(
    () => ({
      readOnly: true,
      minimap: { enabled: false },
      fontSize: 14
    }),
    []
  );

  return (
    <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Opponent screen</p>
          <p className="text-lg font-semibold">Match {matchId}</p>
        </div>
        <div className="rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-300">Live</div>
      </div>
      <Editor height="520px" language="typescript" options={options} value={'// Opponent code will mirror here via Yjs/WebRTC'} />
    </div>
  );
}
