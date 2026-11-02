"use client";

import type { Language, PracticeResultPayload } from '@codebattle/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { CodeWorkspace } from '@/components/editor/CodeWorkspace';
import type { Ghost } from '@/lib/ghost';
import { getBattleSocket, type BattleSocket } from '@/lib/socket';
import type { PublicQuestion } from '@/lib/questions';

import { GhostOffer, GhostRace } from './GhostRace';
import { ProblemPanel } from './ProblemPanel';

interface PracticeRoomProps {
  question: PublicQuestion;
  solvedBefore: boolean;
  /** recorded battles on this problem, best first */
  ghosts?: Ghost[];
  /** the ghost chosen with ?ghost= */
  ghost?: Ghost | null;
}

export function PracticeRoom({ question, solvedBefore, ghosts = [], ghost = null }: PracticeRoomProps): JSX.Element {
  const [socket, setSocket] = useState<BattleSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState<'run' | 'submit' | null>(null);
  const [result, setResult] = useState<PracticeResultPayload | null>(null);
  const [solved, setSolved] = useState(solvedBefore);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'problem' | 'code'>('code');
  const [raceStart, setRaceStart] = useState<number | null>(null);
  const [raceSolvedAt, setRaceSolvedAt] = useState<number | null>(null);
  const raceStartRef = useRef<number | null>(null);
  raceStartRef.current = raceStart;
  const router = useRouter();
  // Ghost code is only sent once you have an accepted attempt; after your first
  // accept, re-render the server page so it arrives.
  const ghostLocked = ghost !== null && !ghost.codeUnlocked;
  useEffect(() => {
    if (solved && !solvedBefore && ghostLocked) router.refresh();
  }, [solved, solvedBefore, ghostLocked, router]);

  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false; // cleaned up before the socket promise resolved: don't attach listeners
    getBattleSocket()
      .then(({ socket: s }) => {
        if (cancelled) return;
        setSocket(s);
        setConnected(s.connected);
        const onConnect = () => setConnected(true);
        const onDisconnect = () => setConnected(false);
        const onResult = (p: PracticeResultPayload) => {
          if (p.slug !== question.slug) return;
          setResult(p);
          setBusy(null);
          if (p.kind === 'submit' && p.verdict === 'ACCEPTED') {
            setSolved(true);
            const started = raceStartRef.current;
            if (started !== null) setRaceSolvedAt(prev => prev ?? Date.now() - started);
          }
        };
        const onError = (e: { message: string }) => {
          setBusy(null);
          setError(e.message);
        };
        s.on('connect', onConnect);
        s.on('disconnect', onDisconnect);
        s.on('practice:result', onResult);
        s.on('error', onError);
        off = () => {
          s.off('connect', onConnect);
          s.off('disconnect', onDisconnect);
          s.off('practice:result', onResult);
          s.off('error', onError);
        };
      })
      .catch(() => setError('Your session expired. Sign in again to run code.'));
    return () => {
      cancelled = true;
      off?.();
    };
  }, [question.slug]);

  const send = (kind: 'run' | 'submit') => (code: string, language: Language) => {
    if (!socket) return;
    setError(null);
    setBusy(kind);
    socket.emit(kind === 'run' ? 'practice:run' : 'practice:submit', { slug: question.slug, code, language });
  };

  const banner =
    result?.kind === 'submit' ? (
      <div className={`border-b border-line px-4 py-2 text-sm ${result.verdict === 'ACCEPTED' ? 'bg-pass/5 text-pass' : 'bg-fail/5 text-muted'}`}>
        {result.verdict === 'ACCEPTED'
          ? 'Solved. Every hidden test passed, including the large inputs.'
          : 'Judged on all tests. Below are the examples and the first hidden test that failed.'}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <Link href="/practice" className="hover:text-text">
            Practice
          </Link>{' '}
          / {question.title}
          {solved ? <span className="ml-3 font-semibold text-pass">Solved</span> : null}
        </p>
        <div className="segmented lg:hidden" role="tablist" aria-label="Practice view">
          <button type="button" role="tab" aria-selected={tab === 'problem'} onClick={() => setTab('problem')}>
            Problem
          </button>
          <button type="button" role="tab" aria-selected={tab === 'code'} onClick={() => setTab('code')}>
            Code
          </button>
        </div>
      </div>
      {ghost ? (
        <GhostRace
          slug={question.slug}
          ghost={ghost}
          others={ghosts}
          startedAt={raceStart}
          solvedAtMs={raceSolvedAt}
          onStart={() => {
            setRaceSolvedAt(null);
            setRaceStart(Date.now());
            setTab('code');
          }}
          onReset={() => {
            setRaceSolvedAt(null);
            setRaceStart(null);
          }}
        />
      ) : (
        <GhostOffer slug={question.slug} ghosts={ghosts} />
      )}
      {error ? (
        <p role="alert" className="rounded-md border border-fail/40 bg-fail/10 px-4 py-2 text-sm text-fail">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 lg:h-[calc(100vh-11rem)] lg:min-h-[640px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className={`${tab === 'problem' ? 'block' : 'hidden'} min-h-0 lg:block`}>
          <ProblemPanel question={question} />
        </div>
        <div className={`${tab === 'code' ? 'block' : 'hidden'} min-h-0 lg:block`}>
          <CodeWorkspace
            starterCode={question.starterCode}
            draftKey={`practice:${question.slug}`}
            busy={busy}
            runDisabled={!connected}
            submitDisabled={!connected}
            submitLabel="Submit"
            onRun={send('run')}
            onSubmit={send('submit')}
            result={result}
            banner={banner}
          />
        </div>
      </div>
    </div>
  );
}
