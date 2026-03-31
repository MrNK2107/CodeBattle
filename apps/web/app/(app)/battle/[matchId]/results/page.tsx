import { FinalScore } from '@codebattle/shared';
import dynamic from 'next/dynamic';

const RadarChart = dynamic(() => import('../../../../../components/scoring/RadarChart'), { ssr: false });

interface ResultsPageProps {
  params: { matchId: string };
}

const sampleScores: FinalScore[] = [
  {
    matchId: 'sample',
    userId: 'you',
    total: 87,
    breakdown: { correctness: 35, speed: 22, efficiency: 16, typing: 8, quality: 6 }
  },
  {
    matchId: 'sample',
    userId: 'opponent',
    total: 82,
    breakdown: { correctness: 32, speed: 20, efficiency: 15, typing: 9, quality: 6 }
  }
];

export default function ResultsPage({ params }: ResultsPageProps): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-400">Match {params.matchId}</p>
        <h1 className="text-2xl font-semibold">Results</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Score breakdown</p>
          <RadarChart scores={sampleScores} />
        </div>
        <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Elo change</p>
          <p className="text-3xl font-semibold text-white">+12 / -8</p>
          <p className="text-slate-300">Animated number counters and code diff view will be wired here.</p>
        </div>
      </div>
    </div>
  );
}
