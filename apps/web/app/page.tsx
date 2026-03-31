import Link from 'next/link';

export default function Home(): JSX.Element {
  return (
    <main className="flex flex-col gap-6">
      <div>
        <p className="text-sm uppercase text-slate-400">CodeBattle</p>
        <h1 className="text-3xl font-semibold">Real-time coding duels</h1>
        <p className="text-slate-300">Find a match, battle on the same problem, and see your opponent in real time.</p>
      </div>
      <div className="flex gap-3">
        <Link className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" href="/app">
          Enter lobby
        </Link>
        <Link className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium" href="/login">
          Log in
        </Link>
      </div>
    </main>
  );
}
