"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useLobbySocket } from './FindMatch';

export function AcceptChallenge({ code }: { code: string }): JSX.Element {
  const { socket, error: connectionError } = useLobbySocket();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit('room:join', { code });
    const onError = (e: { code: string; message: string }) => setError(e.message);
    socket.on('error', onError);
    if (socket.connected) join();
    else socket.once('connect', join);
    return () => {
      socket.off('error', onError);
      socket.off('connect', join);
    };
  }, [socket, code]);

  const message = error ?? connectionError;

  return (
    <div className="mx-auto max-w-md space-y-4 pt-12 text-center">
      <h1 className="text-3xl font-semibold">{message ? 'Can’t start this battle' : 'Joining the battle…'}</h1>
      <p className={message ? 'text-fail' : 'text-muted'} role={message ? 'alert' : 'status'}>
        {message ?? `Accepting challenge ${code}. You’ll be taken to the battle in a moment.`}
      </p>
      {message ? (
        <Link className="btn-primary" href="/app">
          Go to the lobby
        </Link>
      ) : null}
    </div>
  );
}
