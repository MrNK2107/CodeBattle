"use client";

import type { ScoreBreakdown } from '@codebattle/shared';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart as RechartsRadarChart, ResponsiveContainer, Tooltip } from 'recharts';

const METRICS: Array<{ key: keyof ScoreBreakdown; label: string }> = [
  { key: 'correctness', label: 'Correctness' },
  { key: 'speed', label: 'Speed' },
  { key: 'efficiency', label: 'Efficiency' },
  { key: 'typing', label: 'Typing' },
  { key: 'quality', label: 'Quality' },
];

interface RadarChartProps {
  a: { name: string; breakdown: ScoreBreakdown };
  b: { name: string; breakdown: ScoreBreakdown };
}

export default function RadarChart({ a, b }: RadarChartProps): JSX.Element {
  const data = METRICS.map(m => ({ metric: m.label, a: Math.round(a.breakdown[m.key]), b: Math.round(b.breakdown[m.key]) }));
  return (
    <div className="h-72" role="img" aria-label={`Score breakdown for ${a.name} and ${b.name}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="#262A38" />
          <PolarAngleAxis dataKey="metric" stroke="#959AB0" tick={{ fontSize: 12, fill: '#959AB0' }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: '#1A1D28', border: '1px solid #262A38', borderRadius: 6, fontSize: 12, color: '#ECEDF3' }}
            itemStyle={{ color: '#ECEDF3' }}
          />
          <Radar name={a.name} dataKey="a" stroke="#38D6F5" fill="#38D6F5" fillOpacity={0.3} strokeWidth={2} />
          <Radar name={b.name} dataKey="b" stroke="#FF8F2B" fill="#FF8F2B" fillOpacity={0.18} strokeWidth={2} />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
