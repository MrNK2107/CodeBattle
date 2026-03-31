interface ProfilePageProps {
  params: { username: string };
}

export default function ProfilePage({ params }: ProfilePageProps): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Profile</p>
          <h1 className="text-2xl font-semibold">{params.username}</h1>
          <p className="text-slate-300">Rating, history, typing stats, and charts will appear here.</p>
        </div>
        <div className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200">Tier TBD</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">Rating history chart placeholder</div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">Recent matches table placeholder</div>
      </div>
    </div>
  );
}
