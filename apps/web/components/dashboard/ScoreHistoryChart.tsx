"use client";
// components/dashboard/ScoreHistoryChart.tsx
// Recharts line chart showing visibility score over time.

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { formatDate } from "@/lib/utils";

interface Props {
  history: Array<{ computedAt: string; overallScore: number }>;
}

export function ScoreHistoryChart({ history }: Props) {
  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        Sync more data to see your score history
      </div>
    );
  }

  const data = history.map((h) => ({
    date: formatDate(h.computedAt),
    score: Math.round(h.overallScore),
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(value: number) => [`${value} / 100`, "Score"]}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#6366f1"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#6366f1" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
