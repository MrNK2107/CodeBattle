type Stat = {
  label: string;
  value: string;
};

const stats: Stat[] = [
  { label: 'Live battles', value: '247' },
  { label: 'Players online', value: '1,842' },
  { label: 'Avg wait time', value: '12s' }
];

export function LobbyStats(): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map(stat => (
        <div key={stat.label} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">{stat.label}</p>
          <p className="text-2xl font-semibold text-white">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
