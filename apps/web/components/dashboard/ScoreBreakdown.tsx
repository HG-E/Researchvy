"use client";
// components/dashboard/ScoreBreakdown.tsx
// Explainability panel — shows each score component with explanation.
// This is the core "WHY" feature that differentiates Researchvy.

import type { VisibilityScoreBreakdown } from "@researchvy/shared";
import { SCORE_WEIGHTS } from "@researchvy/shared";

interface Props {
  breakdown: VisibilityScoreBreakdown;
}

const COMPONENTS: Array<{
  key: keyof VisibilityScoreBreakdown;
  label: string;
  color: string;
  weightKey: keyof typeof SCORE_WEIGHTS;
}> = [
  { key: "citation",      label: "Citation Impact",     color: "#6366f1", weightKey: "citation" },
  { key: "policy",        label: "Policy Influence",    color: "#10b981", weightKey: "policy" },
  { key: "velocity",      label: "Citation Velocity",   color: "#3b82f6", weightKey: "velocity" },
  { key: "collaboration", label: "Collaboration Reach", color: "#8b5cf6", weightKey: "collaboration" },
  { key: "openAccess",    label: "Open Access Rate",    color: "#f59e0b", weightKey: "openAccess" },
];

export function ScoreBreakdown({ breakdown }: Props) {
  return (
    <div className="space-y-5">
      {COMPONENTS.map(({ key, label, color, weightKey }) => {
        const component = breakdown[key];
        const weight = Math.round(SCORE_WEIGHTS[weightKey] * 100);

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-mono">{component.score}/100</span>
                <span className="bg-gray-100 px-1.5 py-0.5 rounded">{weight}% weight</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${component.score}%`, backgroundColor: color }}
              />
            </div>

            {/* Explanation — the "WHY" */}
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              {component.explanation}
            </p>

            {/* Data points as small pills */}
            {component.dataPoints.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {component.dataPoints.map((point) => (
                  <span
                    key={point}
                    className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-mono"
                  >
                    {point}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
