"use client";

import type {
  BattleStatePayload,
  Language,
  MatchCancelledPayload,
  MatchDeadlinePayload,
  MatchStartedPayload,
  OpponentProgressPayload,
  OpponentStatusPayload,
  RunResult,
  RunResultPayload,
  SubmissionResult,
} from '@codebattle/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CodeWorkspace, type Telemetry } from '@/components/editor/CodeWorkspace';
import { CaseDetail } from '@/components/editor/RunResults';
import { ProblemPanel } from '@/components/problem/ProblemPanel';
import { VERDICT_LABEL, formatMs } from '@/lib/format';
import type { PublicQuestion } from '@/lib/questions';
import { getBattleSocket, type BattleSocket } from '@/lib/socket';

import { ConnectionDropped, isServerDrop } from './ConnectionDropped';
import { VersusBar } from './VersusBar';

export interface BattlePlayer {
  userId: string;
  username: string;
  rating: number;
}

interface BattleRoomProps {
  matchId: string;
  mode: 'RANKED' | 'FRIENDLY';
  question: PublicQuestion;
  you: BattlePlayer;
  rival: BattlePlayer;
}

const OPPONENT_STATE: Record<OpponentStatusPayload['status'], string> = {
  typing: 'Typing',
  running: 'Running examples',
  submitted: 'Submitted',
  forfeited: 'Forfeited',
  connected: 'In the room',
  disconnected: 'Disconnected',
};

export function BattleRoom({ matchId, mode, question, you, rival }: BattleRoomProps): JSX.Element {
  const router = useRouter();
  const [socket, setSocket] = useState<BattleSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [status, setStatus] = useState<BattleStatePayload['status']>('WAITING');
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [readyDeadline, setReadyDeadline] = useState<string | null>(null);
  const [suddenDeath, setSuddenDeath] = useState(false);
  const [busy, setBusy] = useState<'run' | 'submit' | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [rivalState, setRivalState] = useState('Joining');
  const [rivalOnline, setRivalOnline] = useState(false);
  const [rivalProgress, setRivalProgress] = useState<{ passed: number; total: number } | null>(null);
  const [rivalVerdict, setRivalVerdict] = useState<SubmissionResult | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [cancelled, setCancelled] = useState<MatchCancelledPayload['reason'] | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'submit'; code: string; language: Language } | { kind: 'forfeit' }>(null);
  const [tab, setTab] = useState<'problem' | 'code'>('code');
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false; // cleaned up before the socket promise resolved: don't attach listeners
    getBattleSocket()
      .then(({ socket: s }) => {
        if (cancelled) return;
        setSocket(s);
        const ready = () => {
          setConnected(true);
          setDropped(false);
          s.emit('battle:ready', { matchId });
        };
        const onDisconnect = (reason: string) => {
          setConnected(false);
          // a server-side disconnect is final until the player reconnects by hand
          if (isServerDrop(reason)) setDropped(true);
        };
        const onState = (p: BattleStatePayload) => {
          if (p.matchId !== matchId) return;
          // a snapshot can arrive after a live event that is newer; never move backwards
          if (p.status === 'WAITING' && statusRef.current !== 'WAITING') return;
          setStatus(p.status);
          setEndsAt(prev => p.endsAt ?? prev);
          setReadyDeadline(p.readyDeadline ?? null);
          setRivalOnline(p.opponentConnected);
          if (p.opponentConnected) setRivalState(p.opponentSubmitted ? 'Submitted' : p.status === 'ACTIVE' ? 'Coding' : 'In the room');
          if (p.submission) setSubmission(p.submission);
          if (p.status === 'COMPLETED') router.replace(`/battle/${matchId}/results`);
          if (p.status === 'ABANDONED') setCancelled('cancelled');
        };
        const onStarted = (p: MatchStartedPayload) => {
          if (p.matchId !== matchId) return;
          setStatus('ACTIVE');
          setEndsAt(p.endsAt);
          setRivalState('Coding');
          setRivalOnline(true);
        };
        const onDeadline = (p: MatchDeadlinePayload) => {
          if (p.matchId !== matchId) return;
          setEndsAt(p.endsAt);
          setSuddenDeath(true);
        };
        const onEnded = (p: { matchId: string }) => {
          if (p.matchId === matchId) router.push(`/battle/${matchId}/results`);
        };
        const onCancelled = (p: MatchCancelledPayload) => {
          if (p.matchId === matchId) setCancelled(p.reason);
        };
        const onOpponent = (p: OpponentStatusPayload) => {
          if (p.matchId !== matchId) return;
          setRivalOnline(p.status !== 'disconnected');
          setRivalState(prev => (prev === 'Submitted' && (p.status === 'typing' || p.status === 'connected') ? prev : OPPONENT_STATE[p.status]));
        };
        const onProgress = (p: OpponentProgressPayload) => {
          if (p.matchId === matchId) setRivalProgress({ passed: p.passed, total: p.total });
        };
        const onRun = (p: RunResultPayload) => {
          if (p.matchId !== matchId) return;
          setRunResult(p);
          setBusy(null);
        };
        const onSubmission = (p: SubmissionResult) => {
          if (p.matchId !== matchId) return;
          if (p.userId === you.userId) {
            setSubmission(p);
            setBusy(null);
          } else {
            setRivalVerdict(p);
            setRivalState(p.status === 'ACCEPTED' ? 'Solved it' : p.status === 'PENDING' ? 'Submitted' : 'Submitted');
          }
        };
        const onError = (e: { code: string; message: string }) => {
          setBusy(null);
          // a withdrawn submission (judge outage) unlocks the editor so the player can submit again
          if (e.code === 'JUDGE_UNAVAILABLE') setSubmission(prev => (prev?.status === 'PENDING' ? null : prev));
          setNotice({ tone: 'error', text: e.message });
        };

        s.on('connect', ready);
        s.on('disconnect', onDisconnect);
        s.on('battle:state', onState);
        s.on('match:started', onStarted);
        s.on('match:deadline', onDeadline);
        s.on('match:ended', onEnded);
        s.on('match:cancelled', onCancelled);
        s.on('opponent:status', onOpponent);
        s.on('opponent:progress', onProgress);
        s.on('run:result', onRun);
        s.on('submission:result', onSubmission);
        s.on('error', onError);
        if (s.connected) ready();
        off = () => {
          s.off('connect', ready);
          s.off('disconnect', onDisconnect);
          s.off('battle:state', onState);
          s.off('match:started', onStarted);
          s.off('match:deadline', onDeadline);
          s.off('match:ended', onEnded);
          s.off('match:cancelled', onCancelled);
          s.off('opponent:status', onOpponent);
          s.off('opponent:progress', onProgress);
          s.off('run:result', onRun);
          s.off('submission:result', onSubmission);
          s.off('error', onError);
        };
      })
      .catch(() => setNotice({ tone: 'error', text: 'Your session expired. Sign in again to rejoin this battle.' }));
    return () => {
      cancelled = true;
      off?.();
    };
  }, [matchId, router, you.userId]);

  const active = status === 'ACTIVE';
  const submitted = submission !== null;

  const run = useCallback(
    (code: string, language: Language) => {
      if (!socket) return;
      setNotice(null);
      setBusy('run');
      socket.emit('battle:run', { matchId, code, language });
    },
    [socket, matchId]
  );

  const doSubmit = useCallback(
    (code: string, language: Language) => {
      if (!socket) return;
      setNotice(null);
      setConfirm(null);
      setBusy('submit');
      socket.emit('battle:submit', { matchId, code, language });
    },
    [socket, matchId]
  );

  const requestSubmit = (code: string, language: Language) => setConfirm({ kind: 'submit', code, language });

  const forfeit = () => {
    setConfirm(null);
    socket?.emit('battle:forfeit', { matchId });
  };

  const telemetry: Telemetry | undefined = useMemo(
    () =>
      socket && active && !submitted
        ? {
            onTyping: (events, pastedChars) => socket.emit('battle:typing', { matchId, events, pastedChars }),
            onSnapshot: (code, language) => socket.emit('battle:snapshot', { matchId, code, language }),
          }
        : undefined,
    [socket, active, submitted, matchId]
  );

  if (cancelled) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pt-10 text-center">
        <h1 className="text-2xl font-semibold">Battle cancelled</h1>
        <p className="text-muted">
          {cancelled === 'not-ready'
            ? 'Both players have to open the battle within a minute. Nobody’s rating changed.'
            : 'The battle was called off before it started. Nobody’s rating changed.'}
        </p>
        <Link className="btn-primary" href="/app">
          Back to the lobby
        </Link>
      </div>
    );
  }

  const yourState = submitted
    ? submission.status === 'PENDING'
      ? 'Judging your submission'
      : `Submitted: ${VERDICT_LABEL[submission.status]}`
    : busy === 'run'
      ? 'Running examples'
      : active
        ? 'Coding'
        : 'In the room';

  const verdictBanner = submission ? <SubmissionBanner submission={submission} rivalVerdict={rivalVerdict} /> : null;

  return (
    <div className="flex flex-col gap-4">
      <VersusBar
        you={{ name: you.username, rating: you.rating, state: yourState, progress: runResult ? { passed: runResult.passed, total: runResult.total } : null, online: connected }}
        rival={{ name: rival.username, rating: rival.rating, state: rivalState, progress: rivalProgress, online: rivalOnline }}
        endsAt={endsAt}
        readyDeadline={readyDeadline}
        suddenDeath={suddenDeath}
      />

      {suddenDeath && !submitted ? (
        <p className="rounded-md border border-rival/40 bg-rival/10 px-4 py-2 text-sm text-rival" role="status">
          {rival.username} solved the problem. Your clock has been cut to five minutes, so submit before it runs out.
        </p>
      ) : null}
      {!active && !cancelled && status === 'WAITING' ? (
        <p className="rounded-md border border-line bg-panel px-4 py-2 text-sm text-muted" role="status">
          Waiting for {rival.username} to open the battle. The clock starts as soon as you are both here.
        </p>
      ) : null}
      {mode === 'FRIENDLY' ? <p className="text-xs text-muted">Friendly battle: ratings don’t change.</p> : null}
      {dropped ? (
        <ConnectionDropped
          onReconnect={() => {
            setNotice(null);
            socket?.connect();
          }}
        />
      ) : notice ? (
        <p role="alert" className={`rounded-md px-4 py-2 text-sm ${notice.tone === 'error' ? 'border border-fail/40 bg-fail/10 text-fail' : 'bg-panel text-muted'}`}>
          {notice.text}
        </p>
      ) : null}

      <div className="segmented self-start lg:hidden" role="tablist" aria-label="Battle view">
        <button type="button" role="tab" aria-selected={tab === 'problem'} onClick={() => setTab('problem')}>
          Problem
        </button>
        <button type="button" role="tab" aria-selected={tab === 'code'} onClick={() => setTab('code')}>
          Code
        </button>
      </div>

      <div className="grid gap-4 lg:h-[calc(100vh-15rem)] lg:min-h-[640px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className={`${tab === 'problem' ? 'block' : 'hidden'} min-h-0 lg:block`}>
          <ProblemPanel
            question={question}
            footer={
              <div className="border-t border-line pt-4">
                <button type="button" className="text-sm text-muted hover:text-fail" onClick={() => setConfirm({ kind: 'forfeit' })}>
                  {active ? 'Forfeit this battle' : 'Leave this battle'}
                </button>
              </div>
            }
          />
        </div>
        <div className={`${tab === 'code' ? 'block' : 'hidden'} min-h-0 lg:block`}>
          <CodeWorkspace
            starterCode={question.starterCode}
            draftKey={`battle:${matchId}`}
            readOnly={submitted}
            busy={busy}
            runDisabled={!active || !connected}
            submitDisabled={!active || !connected}
            submitLabel="Submit final answer"
            onRun={run}
            onSubmit={requestSubmit}
            result={runResult}
            banner={verdictBanner}
            telemetry={telemetry}
          />
        </div>
      </div>

      {confirm ? (
        <ConfirmDialog
          title={confirm.kind === 'submit' ? 'Submit your final answer?' : active ? 'Forfeit this battle?' : 'Leave this battle?'}
          body={
            confirm.kind === 'submit'
              ? runResult && runResult.verdict !== 'ACCEPTED'
                ? 'Your last run failed some examples. You only get one submission, and it is judged on hidden tests.'
                : runResult
                  ? 'You only get one submission. It is judged on the hidden tests, including large inputs.'
                  : 'You haven’t run the examples yet. You only get one submission, and it is judged on hidden tests.'
              : active
                ? `${rival.username} wins immediately${mode === 'RANKED' ? ' and your rating drops' : ''}.`
                : 'The battle hasn’t started, so it is cancelled and nobody’s rating changes.'
          }
          confirmLabel={confirm.kind === 'submit' ? 'Submit' : active ? 'Forfeit' : 'Leave'}
          danger={confirm.kind === 'forfeit'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => (confirm.kind === 'submit' ? doSubmit(confirm.code, confirm.language) : forfeit())}
        />
      ) : null}
    </div>
  );
}

function SubmissionBanner({ submission, rivalVerdict }: { submission: SubmissionResult; rivalVerdict: SubmissionResult | null }): JSX.Element {
  const pending = submission.status === 'PENDING';
  const ok = submission.status === 'ACCEPTED';
  return (
    <div className={`space-y-2 border-b border-line px-4 py-3 ${pending ? '' : ok ? 'bg-pass/5' : 'bg-fail/5'}`} role="status">
      <p className="text-xs text-muted">Your submission</p>
      {pending ? (
        <div className="space-y-2">
          <p className="font-display text-lg font-semibold">Judging against hidden tests…</p>
          <div className="h-1 overflow-hidden rounded bg-raised">
            <div className="h-1 w-1/3 animate-sweep rounded bg-you" />
          </div>
        </div>
      ) : (
        <>
          <p className={`font-display text-lg font-semibold ${ok ? 'text-pass' : 'text-fail'}`}>
            {VERDICT_LABEL[submission.status]}
            <span className="ml-3 font-sans text-sm font-normal text-muted">
              {submission.passedTests} of {submission.totalTests} hidden tests
              {submission.runtimeMs ? `, ${formatMs(submission.runtimeMs)} total` : ''}
            </span>
          </p>
          {submission.message ? (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-fail/10 p-3 font-mono text-xs text-fail">{submission.message}</pre>
          ) : null}
          {submission.failedTest ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted hover:text-text">Show the first failing hidden test</summary>
              <div className="mt-2">
                <CaseDetail result={submission.failedTest} />
              </div>
            </details>
          ) : null}
          <p className="text-sm text-muted">
            {rivalVerdict && rivalVerdict.status !== 'PENDING'
              ? 'Both answers are in. Scoring the battle…'
              : 'Waiting for your opponent. The battle ends when they submit or the clock runs out.'}
          </p>
        </>
      )}
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md space-y-4 rounded-lg border border-line bg-panel p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted">{body}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-quiet" onClick={onCancel} autoFocus>
            Keep coding
          </button>
          <button type="button" className={danger ? 'btn-danger' : 'btn-submit'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
