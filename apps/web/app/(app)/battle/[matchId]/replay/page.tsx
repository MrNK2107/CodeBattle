interface ReplayPageProps {
  params: { matchId: string };
}

export default function ReplayPage({ params }: ReplayPageProps): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-400">Replay</p>
        <h1 className="text-2xl font-semibold">Match {params.matchId}</h1>
        <p className="text-slate-300">Keystroke playback controls will be wired here.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">Player A replay pane</div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">Player B replay pane</div>
      </div>
    </div>
  );
}
