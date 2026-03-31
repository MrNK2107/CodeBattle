export default function AdminPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-400">Admin</p>
        <h1 className="text-2xl font-semibold">Control panel</h1>
        <p className="text-slate-300">Manage questions, matches, users, and submissions.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">Question manager placeholder</div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">Live matches placeholder</div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">User manager placeholder</div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">Submission logs placeholder</div>
      </div>
    </div>
  );
}
