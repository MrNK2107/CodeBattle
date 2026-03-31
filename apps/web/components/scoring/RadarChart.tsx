"use client";

import { FinalScore } from '@codebattle/shared';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart as RechartsRadarChart, ResponsiveContainer, Tooltip } from 'recharts';

interface RadarChartProps {
  scores: FinalScore[];
}

export default function RadarChart({ scores }: RadarChartProps): JSX.Element {
  const chartData = ['correctness', 'speed', 'efficiency', 'typing', 'quality'].map(key => ({
    metric: key,
    you: scores[0]?.breakdown[key as keyof FinalScore['breakdown']] ?? 0,
    opponent: scores[1]?.breakdown[key as keyof FinalScore['breakdown']] ?? 0
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={chartData} outerRadius="80%">
          <PolarGrid stroke="#1f2937" />
          <PolarAngleAxis dataKey="metric" stroke="#cbd5e1" />
          <Tooltip />
          <Radar name="You" dataKey="you" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.6} />
          <Radar name="Opponent" dataKey="opponent" stroke="#10B981" fill="#10B981" fillOpacity={0.4} />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
