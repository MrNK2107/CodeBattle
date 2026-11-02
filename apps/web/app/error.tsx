"use client";

import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }): JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-md space-y-4 pt-16 text-center">
      <h1 className="text-2xl font-semibold">This page failed to load</h1>
      <p className="text-muted">The server couldn’t finish the request. Try again, and if it keeps happening, check that the database is running.</p>
      <button type="button" className="btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
