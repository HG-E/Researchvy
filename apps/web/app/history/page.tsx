"use client";
// apps/web/app/history/page.tsx
// Score history — shows score trend over time with context about what changed.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Navbar } from "@/components/ui/Navbar";
import { ScoreHistoryChart } from "@/components/dashboard/ScoreHistoryChart";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { useAuth } from "@/lib/auth-context";
import { visibility } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { getScoreBand } from "@researchvy/shared";
import Link from "next/link";

interface HistoryEntry {
  computedAt: string;
  overallScore: number;
  citationScore?: number;
  velocityScore?: number;
  policyScore?: number;
  openAccessScore?: number;
  collaborationScore?: number;
  algorithmVersion?: string;
}

function fetchHistory(): Promise<HistoryEntry[]> {
  return visibility.history().then((res) => {
    if (!res.success) return [];
    return res.data as HistoryEntry[];
  });
}

export default function HistoryPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: history = [], isLoading } = useSWR<HistoryEntry[]>(
    "score-history",
    fetchHistory,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/auth/login");
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96" aria-busy="true" aria-live="polite">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        </div>
      </div>
    );
  }

  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const delta = latest && prev ? latest.overallScore - prev.overallScore : null;

  // Compute best and worst scores
  const scores = history.map((h) => h.overallScore);
  const maxScore = scores.length > 0 ? Math.max(...scores) : null;
  const minScore = scores.length > 0 ? Math.min(...scores) : null;

  // 30-day change
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oldEntry = [...history].reverse().find(
    (h) => new Date(h.computedAt) <= thirtyDaysAgo
  );
  const monthDelta = latest && oldEntry
    ? latest.overallScore - oldEntry.overallScore
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main id="main" className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Score History</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Track how your visibility has changed over time
            </p>
          </div>
          <Link
            href="/report"
            className="text-sm border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:border-gray-400 transition-colors"
          >
            Export report →
          </Link>
        </div>

        {history.length === 0 ? (
          <div className="card p-12 text-center" role="status">
            <p className="text-3xl mb-3" aria-hidden="true">📈</p>
            <p className="text-lg font-semibold text-gray-800 mb-2">No history yet</p>
            <p className="text-sm text-gray-500 mb-6">
              Sync your publications to compute your first visibility score.
              History will appear here after each sync.
            </p>
            <Link
              href="/dashboard"
              className="bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Go to dashboard →
            </Link>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                {
                  label: "Current score",
                  value: latest?.overallScore ?? "—",
                  sub: latest ? getScoreBand(latest.overallScore)?.label : undefined,
                  highlight: false,
                },
                {
                  label: "30-day change",
                  value: monthDelta !== null
                    ? `${monthDelta >= 0 ? "+" : ""}${monthDelta.toFixed(1)}`
                    : "—",
                  sub: monthDelta !== null
                    ? monthDelta >= 0 ? "Improving" : "Declining"
                    : "Not enough data",
                  highlight: monthDelta !== null,
                  positive: monthDelta !== null && monthDelta >= 0,
                },
                {
                  label: "Best score",
                  value: maxScore ?? "—",
                  sub: maxScore !== null ? `All time high` : undefined,
                  highlight: false,
                },
                {
                  label: "Data points",
                  value: history.length,
                  sub: `since ${history[0] ? formatDate(history[0].computedAt) : "—"}`,
                  highlight: false,
                },
              ].map((stat) => (
                <div key={stat.label} className="card p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">{stat.label}</p>
                  <p
                    className={`text-2xl font-extrabold tabular-nums ${
                      stat.highlight
                        ? stat.positive
                          ? "text-emerald-600"
                          : "text-red-600"
                        : "text-gray-900"
                    }`}
                    aria-label={`${stat.label}: ${stat.value}`}
                  >
                    {stat.value}
                  </p>
                  {stat.sub && (
                    <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="card p-6 mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Visibility Score Over Time
              </h2>
              <ScoreHistoryChart history={history} />
            </div>

            {/* Entry table */}
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  All Score Snapshots
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table
                  className="w-full text-sm"
                  aria-label="Score history table"
                >
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {["Date", "Score", "Band", "Citation", "Velocity", "Policy", "Open Access", "Collab", "Change"].map(
                        (col) => (
                          <th
                            key={col}
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...history].reverse().map((entry, i, arr) => {
                      const prevEntry = arr[i + 1];
                      const change = prevEntry
                        ? entry.overallScore - prevEntry.overallScore
                        : null;
                      const band = getScoreBand(entry.overallScore);

                      return (
                        <tr
                          key={entry.computedAt}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            {formatDate(entry.computedAt)}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900 tabular-nums">
                            {entry.overallScore.toFixed(1)}
                          </td>
                          <td className="px-4 py-3">
                            {band && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  backgroundColor: `${band.color}22`,
                                  color: band.color,
                                }}
                              >
                                {band.label}
                              </span>
                            )}
                          </td>
                          {[
                            entry.citationScore,
                            entry.velocityScore,
                            entry.policyScore,
                            entry.openAccessScore,
                            entry.collaborationScore,
                          ].map((score, j) => (
                            <td key={j} className="px-4 py-3 text-gray-600 tabular-nums">
                              {score !== undefined ? score.toFixed(0) : "—"}
                            </td>
                          ))}
                          <td className="px-4 py-3 tabular-nums">
                            {change !== null ? (
                              <span
                                className={`font-medium ${
                                  change > 0
                                    ? "text-emerald-600"
                                    : change < 0
                                    ? "text-red-600"
                                    : "text-gray-400"
                                }`}
                                aria-label={`${change >= 0 ? "increased" : "decreased"} by ${Math.abs(change).toFixed(1)}`}
                              >
                                {change > 0 ? "+" : ""}
                                {change.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
