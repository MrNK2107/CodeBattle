import Link from 'next/link';

export default function LoginPage(): JSX.Element {
  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-slate-400">Authenticate with GitHub, Google, or email/password.</p>
      </div>
      <form className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm text-slate-300">Email</label>
          <input className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" type="email" name="email" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-slate-300">Password</label>
          <input className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" type="password" name="password" />
        </div>
        <button className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" type="submit">
          Continue
        </button>
      </form>
      <div className="text-sm text-slate-400">
        New here? <Link className="text-primary" href="/register">Create an account</Link>
      </div>
    </div>
  );
}
