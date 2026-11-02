"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { FormEvent, Suspense, useState } from 'react';

import { safeCallback } from '@/lib/callback';

function RegisterForm(): JSX.Element {
  const searchParams = useSearchParams();
  const callbackUrl = safeCallback(searchParams.get('callbackUrl'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const username = String(data.get('username') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const college = String(data.get('college') ?? '').trim();

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, college }),
    }).catch(() => null);
    if (!response || !response.ok) {
      const payload = (await response?.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? 'Could not create the account. Check your connection and try again.');
      setLoading(false);
      return;
    }

    const result = await signIn('credentials', { redirect: false, email, password, callbackUrl });
    if (!result || result.error) {
      setError('Your account was created, but signing in failed. Sign in with your new details.');
      setLoading(false);
      return;
    }
    window.location.href = callbackUrl;
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <div className="space-y-1">
        <p className="kicker">Step into the ring</p>
        <h1 className="text-3xl font-semibold">Create an account</h1>
        <p className="text-muted">You start at 1200, Silver I. Your username is shown to opponents.</p>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <label className="block text-sm" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className="input"
            name="username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_\-]+"
            title="3–20 letters, numbers, - or _"
            disabled={loading}
          />
          <p className="text-xs text-faint">3–20 letters, numbers, dashes or underscores.</p>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm" htmlFor="email">
            Email
          </label>
          <input id="email" className="input" type="email" name="email" autoComplete="email" required disabled={loading} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm" htmlFor="password">
            Password
          </label>
          <input id="password" className="input" type="password" name="password" autoComplete="new-password" minLength={8} required disabled={loading} />
          <p className="text-xs text-faint">At least 8 characters.</p>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm" htmlFor="college">
            College or club <span className="text-faint">(optional)</span>
          </label>
          <input id="college" className="input" name="college" maxLength={60} placeholder="e.g. Anna University" disabled={loading} />
          <p className="text-xs text-faint">Your ranked battles count toward its place on the college leaderboard.</p>
        </div>
        {error ? (
          <p className="text-sm text-fail" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="text-sm text-muted">
        Already have an account?{' '}
        <Link className="link" href="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
