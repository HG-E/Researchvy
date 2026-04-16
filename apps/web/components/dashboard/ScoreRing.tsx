"use client";
// components/dashboard/ScoreRing.tsx
// Animated SVG ring that visualises the overall visibility score.
// Pure presentational — no data fetching.

import { useEffect, useState } from "react";
import { getScoreBand } from "@researchvy/shared";

interface ScoreRingProps {
  score: number; // 0–100
  size?: number;
  strokeWidth?: number;
}

export function ScoreRing({ score, size = 160, strokeWidth = 12 }: ScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const band = getScoreBand(score);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Map score 0–100 to dashoffset (0 = full ring, circumference = empty)
  const offset = circumference - (animatedScore / 100) * circumference;

  // Animate score in on mount
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Score arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={band?.color ?? "#6366f1"}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="score-ring"
          />
        </svg>

        {/* Score number in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-extrabold text-gray-900 tabular-nums">
            {Math.round(animatedScore)}
          </span>
          <span className="text-xs text-gray-400 font-medium">/ 100</span>
        </div>
      </div>

      {/* Band label */}
      <span
        className="text-xs font-semibold px-3 py-1 rounded-full"
        style={{ backgroundColor: `${band?.color}22`, color: band?.color }}
      >
        {band?.label ?? "—"}
      </span>
    </div>
  );
}
