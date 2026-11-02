"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface RatingPoint {
  label: string;
  rating: number;
}

export function RatingChart({ points }: { points: RatingPoint[] }): JSX.Element {
  if (points.length < 2) {
    return <p className="grid h-56 place-items-center text-sm text-muted">Play a couple of ranked battles to see your rating over time.</p>;
  }
  const ratings = points.map(p => p.rating);
  const min = Math.floor((Math.min(...ratings) - 20) / 50) * 50;
  const max = Math.ceil((Math.max(...ratings) + 20) / 50) * 50;
  return (
    <div className="h-56" role="img" aria-label={`Rating history from ${points[0].rating} to ${points[points.length - 1].rating}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#262A38" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#60657B', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis domain={[min, max]} tick={{ fill: '#60657B', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            contentStyle={{ background: '#1A1D28', border: '1px solid #262A38', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#959AB0' }}
            itemStyle={{ color: '#38D6F5' }}
          />
          <Line type="monotone" dataKey="rating" stroke="#38D6F5" strokeWidth={2} dot={{ r: 2.5, fill: '#38D6F5' }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
