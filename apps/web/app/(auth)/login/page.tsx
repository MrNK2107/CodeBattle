"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getProviders, signIn } from 'next-auth/react';
import { FormEvent, Suspense, useEffect, useState } from 'react';

import { safeCallback } from '@/lib/callback';

type ProviderMap = Awaited<ReturnType<typeof getProviders>>;

const ERRORS: Record<string, string> = {
  CredentialsSignin: 'That email and password don’t match an account.',
  OAuthAccountNotLinked: 'This email is already registered with a different sign-in method.',
  SessionRequired: 'Sign in to continue.',
};


function LoginForm(): JSX.Element {
  const searchParams = useSearchParams();
  const callbackUrl = safeCallback(searchParams.get('callbackUrl'));
  const initialError = searchParams.get('error');

  const [providers, setProviders] = useState<ProviderMap>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ? ERRORS[initialError] ?? 'Sign-in failed. Try again.' : null);

  useEffect(() => {
    getProviders().then(setProviders).catch(() => setProviders(null));
  }, []);

  const finish = (result: Awaited<ReturnType<typeof signIn>>, message: string) => {
    if (!result || result.error) {
      setError(message);
      setLoading(false);
      return;
    }
    window.location.href = callbackUrl;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const result = await signIn('credentials', {
      redirect: false,
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      callbackUrl,
    });
    finish(result, ERRORS.CredentialsSignin);
  };

  const devLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const result = await signIn('dev', { redirect: false, username: String(data.get('username') ?? ''), callbackUrl });
    finish(result, 'Dev login failed.');
  };

  const oauth = (['github', 'google'] as const).filter(id => providers?.[id]);

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">Sign in</h1>
        <p className="text-muted">Your rating and battle history follow your account.</p>
      </div>

      {providers?.dev ? (
        <form className="space-y-3 rounded-lg border border-you/40 bg-you/5 p-4" onSubmit={devLogin}>
          <div>
            <p className="font-semibold">Local dev login</p>
            <p className="text-xs text-muted">Any username, no password. Only available when DEV_LOGIN=1 outside production.</p>
          </div>
          <div className="flex gap-2">
            <input aria-label="Username" className="input" name="username" placeholder="alice" required disabled={loading} />
            <button className="btn-primary shrink-0" disabled={loading} type="submit">
              Enter
            </button>
          </div>
        </form>
      ) : null}

      {oauth.length ? (
        <div className="grid gap-2">
          {oauth.map(id => (
            <button
              key={id}
              type="button"
              className="btn-quiet w-full"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                void signIn(id, { callbackUrl });
              }}
            >
              Continue with {providers?.[id]?.name}
            </button>
          ))}
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={submit}>
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
          <input id="password" className="input" type="password" name="password" autoComplete="current-password" required disabled={loading} />
        </div>
        {error ? (
          <p className="text-sm text-fail" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="text-sm text-muted">
        New here?{' '}
        <Link className="link" href={`/register${callbackUrl !== '/app' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}>
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
