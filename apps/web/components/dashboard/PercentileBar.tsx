"use client";
// components/dashboard/PercentileBar.tsx
// Shows where the researcher ranks vs peers in their field.
// Percentile is computed server-side during score calculation.

interface PercentileBarProps {
  percentile: number;   // 0–100, higher = better (e.g. 82 = top 18%)
  field?: string;       // Primary research field for context
  totalResearchers?: number; // Total in comparison pool
}

export function PercentileBar({ percentile, field, totalResearchers }: PercentileBarProps) {
  const topPercent = 100 - percentile;

  const getBandLabel = (p: number) => {
    if (p <= 10) return { label: "Top 10%", color: "#f97316" };
    if (p <= 25) return { label: "Top 25%", color: "#fbbf24" };
    if (p <= 50) return { label: "Top 50%", color: "#34d399" };
    return { label: "Bottom 50%", color: "#94a3b8" };
  };

  const band = getBandLabel(topPercent);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">
            Ranked{" "}
            <span style={{ color: band.color }} className="font-bold">
              {band.label}
            </span>
            {field && (
              <span className="text-gray-500 font-normal"> in {field}</span>
            )}
          </p>
          {totalResearchers && (
            <p className="text-xs text-gray-400 mt-0.5">
              vs {totalResearchers.toLocaleString()} researchers in OpenAlex
            </p>
          )}
        </div>
        <span
          className="text-2xl font-extrabold tabular-nums"
          style={{ color: band.color }}
          aria-label={`${topPercent}th percentile`}
        >
          {topPercent}
          <span className="text-sm font-medium text-gray-400">%ile</span>
        </span>
      </div>

      {/* Bar */}
      <div
        className="h-3 bg-gray-100 rounded-full overflow-hidden relative"
        role="progressbar"
        aria-valuenow={percentile}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Percentile rank: top ${topPercent}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${percentile}%`, backgroundColor: band.color }}
        />
        {/* Marker at the researcher's position */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 rounded-full shadow"
          style={{ left: `calc(${percentile}% - 6px)`, borderColor: band.color }}
          aria-hidden="true"
        />
      </div>

      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>Less visible</span>
        <span>Most visible</span>
      </div>
    </div>
  );
}
