"use client";

import type { QueueDifficulty, RoomCreatedPayload } from '@codebattle/shared';
import { useEffect, useState } from 'react';

import { DIFFICULTY_CHOICES, useLobbySocket } from './FindMatch';

export function ChallengeFriend(): JSX.Element {
  const { socket } = useLobbySocket();
  const [difficulty, setDifficulty] = useState<QueueDifficulty>('ANY');
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onCreated = (p: RoomCreatedPayload) => setCode(p.code);
    const onError = (e: { code: string; message: string }) => {
      if (e.code.startsWith('ROOM')) setError(e.message);
    };
    socket.on('room:created', onCreated);
    socket.on('error', onError);
    return () => {
      socket.off('room:created', onCreated);
      socket.off('error', onError);
    };
  }, [socket]);

  const link = code ? `${window.location.origin}/challenge/${code}` : '';

  const create = () => {
    setError(null);
    setCopied(false);
    socket?.emit('room:create', { difficulty });
  };

  const cancel = () => {
    socket?.emit('room:cancel');
    setCode(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="panel space-y-4 p-5" aria-labelledby="challenge-title">
      <div>
        <h2 id="challenge-title" className="text-xl font-semibold">
          Challenge a friend
        </h2>
        <p className="text-sm text-muted">Send a link. Friendly battles don’t change anyone’s rating.</p>
      </div>
      {code ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input className="input max-w-xs flex-1 font-mono" readOnly value={link} aria-label="Challenge link" onFocus={e => e.currentTarget.select()} />
            <button type="button" className="btn-primary" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" className="btn-quiet" onClick={cancel}>
              Cancel
            </button>
          </div>
          <p className="text-sm text-muted" role="status">
            Waiting for your friend to open the link. Keep this page open; the battle starts as soon as they accept.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="segmented" role="radiogroup" aria-label="Challenge difficulty">
            {DIFFICULTY_CHOICES.map(d => (
              <button key={d.value} type="button" role="radio" aria-checked={difficulty === d.value} onClick={() => setDifficulty(d.value)}>
                {d.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn-quiet" onClick={create} disabled={!socket}>
            Create a challenge link
          </button>
        </div>
      )}
      {error ? <p className="text-sm text-fail">{error}</p> : null}
    </section>
  );
}
