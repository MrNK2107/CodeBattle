"use client";

import { notFound } from 'next/navigation';
import { CodeEditor } from '../../../../components/editor/CodeEditor';
import { OpponentView } from '../../../../components/editor/OpponentView';
import { StatusBar } from '../../../../components/battle/StatusBar';
import { TestResults } from '../../../../components/battle/TestResults';
import { useBattleState } from '../../../../lib/state';

interface BattlePageProps {
  params: { matchId?: string };
}

export default function BattlePage({ params }: BattlePageProps): JSX.Element {
  if (!params.matchId) {
    notFound();
  }

  const { results } = useBattleState.getState();

  return (
    <div className="flex flex-col gap-4">
      <StatusBar matchId={params.matchId} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <CodeEditor matchId={params.matchId} />
          <TestResults results={results} />
        </div>
        <OpponentView matchId={params.matchId} />
      </div>
    </div>
  );
}
