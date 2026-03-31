"use client";

import { useEffect, useState } from 'react';
import { socket } from '../../lib/socket';
import { useBattleState } from '../../lib/state';

interface StatusBarProps {
  matchId: string;
}

export function StatusBar({ matchId }: StatusBarProps): JSX.Element {
  const { status } = useBattleState();
  const [opponentStatus, setOpponentStatus] = useState('waiting');
  const [timeLeft, setTimeLeft] = useState(45 * 60);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(prev => Math.max(prev - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOpponent = (payload: { status: string }) => setOpponentStatus(payload.status);
    socket.on('opponent:status', handleOpponent);
    return () => socket.off('opponent:status', handleOpponent);
  }, []);

  const format = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-slate-400">Match</span>
        <span className="font-medium text-white">{matchId}</span>
      </div>
      <div className="flex items-center gap-3">
        <StatusPill label="You" value={status} color="primary" />
        <StatusPill label="Opponent" value={opponentStatus} color="warning" />
        <div className="rounded-md bg-slate-800 px-3 py-1 font-mono text-white">{format(timeLeft)}</div>
      </div>
    </div>
  );
}

function StatusPill({ label, value, color }: { label: string; value: string; color: 'primary' | 'warning' }): JSX.Element {
  const palette = color === 'primary' ? 'bg-primary text-white' : 'bg-amber-500/20 text-amber-200';
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{label}</span>
      <span className={`rounded-md px-3 py-1 text-xs capitalize ${palette}`}>{value}</span>
    </div>
  );
}
