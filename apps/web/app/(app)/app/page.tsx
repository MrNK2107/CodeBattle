import Link from 'next/link';
import { LobbyStats } from '../../../components/battle/LobbyStats';

export default function LobbyPage(): JSX.Element {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase text-slate-400">Lobby</p>
          <h1 className="text-2xl font-semibold">Find your next battle</h1>
        </div>
        <Link className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" href="/battle/new">
          Find match
        </Link>
      </div>
      <LobbyStats />
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
        Recent matches, leaderboard, and practice links will appear here.
      </div>
    </div>
  );
}
