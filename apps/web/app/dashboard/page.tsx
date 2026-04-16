"use client";
// apps/web/app/dashboard/page.tsx
// The main dashboard — researcher's home base.
// Loads all data in one fetch via /api/v1/dashboard.

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Navbar } from "@/components/ui/Navbar";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { ScoreBreakdown } from "@/components/dashboard/ScoreBreakdown";
import { ScoreHistoryChart } from "@/components/dashboard/ScoreHistoryChart";
import { SyncButton } from "@/components/dashboard/SyncButton";
import { useAuth } from "@/lib/auth-context";
import { dashboard, auth } from "@/lib/api";
import { formatNumber, formatDate } from "@/lib/utils";
import type { DashboardData, VisibilityScoreBreakdown } from "@researchvy/shared";
import Link from "next/link";

// SWR fetcher — uses our typed API client
const fetcher = () => dashboard.get().then((res) => {
  if (!res.success) throw new Error(res.error.message);
  return res.data;
});

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data, isLoading, mutate } = useSWR<DashboardData>("dashboard", fetcher, {
    revalidateOnFocus: false,
  });

  // Show ORCID connection status from OAuth callback
  const orcidConnected = searchParams.get("orcid_connected");
  const orcidError = searchParams.get("orcid_error");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/auth/login");
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading your dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { researcher, latestScore, scoreHistory, recentPublications, pendingRecommendations, activeSync } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Status banners ── */}
        {orcidConnected && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm">
            ✓ ORCID connected! We&apos;re fetching your publications now — this may take a moment.
          </div>
        )}
        {orcidError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            ORCID connection failed: {orcidError}. Please try again.
          </div>
        )}

        {/* ── Page header ── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {researcher.displayName.split(" ")[0]}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {researcher.institution ?? "No institution set"} ·{" "}
              {researcher.publicationCount} publications · h-index: {researcher.hIndex}
            </p>
          </div>
          <SyncButton activeSync={activeSync} onComplete={() => mutate()} />
        </div>

        {/* ── ORCID connect prompt (if not connected) ── */}
        {!researcher.orcidId && (
          <div className="mb-6 card p-5 border-brand-200 bg-brand-50 flex items-center justify-between">
            <div>
              <p className="font-semibold text-brand-900">Connect your ORCID profile</p>
              <p className="text-sm text-brand-700 mt-0.5">
                Get your full visibility score by linking your ORCID — we&apos;ll import all your publications automatically.
              </p>
            </div>
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/orcid`}
              className="flex-shrink-0 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors ml-4"
            >
              Connect ORCID →
            </a>
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Visibility Score Card ── */}
          <div className="card p-6 lg:col-span-1">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-6">
              Visibility Score
            </h2>

            {latestScore ? (
              <div className="flex flex-col items-center">
                <ScoreRing score={latestScore.overallScore} />
                <p className="text-xs text-gray-400 mt-4">
                  Last computed {formatDate(latestScore.computedAt)} · v{latestScore.algorithmVersion}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600">No score yet</p>
                <p className="text-xs text-gray-400 mt-1">Connect ORCID and sync to compute your score</p>
              </div>
            )}
          </div>

          {/* ── Score Breakdown ── */}
          <div className="card p-6 lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-6">
              Score Breakdown — Why?
            </h2>

            {latestScore ? (
              <ScoreBreakdown breakdown={latestScore.breakdown as unknown as VisibilityScoreBreakdown} />
            ) : (
              <p className="text-sm text-gray-400 py-8 text-center">
                Sync your publications to see a detailed breakdown
              </p>
            )}
          </div>

          {/* ── Score History ── */}
          <div className="card p-6 lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Score History
            </h2>
            <ScoreHistoryChart history={scoreHistory} />
          </div>

          {/* ── Key Stats ── */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Key Metrics
            </h2>
            <div className="space-y-4">
              {[
                { label: "Total Citations", value: formatNumber(researcher.totalCitations), icon: "📚" },
                { label: "h-index",         value: researcher.hIndex.toString(),            icon: "📊" },
                { label: "Publications",    value: formatNumber(researcher.publicationCount), icon: "📄" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span>{stat.icon}</span>
                    <span className="text-sm text-gray-600">{stat.label}</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900 tabular-nums">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Recommendations ── */}
          {pendingRecommendations.length > 0 && (
            <div className="card p-6 lg:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Recommendations to improve your score
                </h2>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  {pendingRecommendations.length} pending
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingRecommendations.map((rec) => (
                  <div key={rec.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500 uppercase">{rec.type.replace("_", " ")}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        rec.impact === "HIGH"   ? "bg-red-100 text-red-700" :
                        rec.impact === "MEDIUM" ? "bg-amber-100 text-amber-700" :
                                                  "bg-gray-100 text-gray-600"
                      }`}>
                        {rec.impact} impact
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{rec.title}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{rec.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Recent Publications ── */}
          <div className="card p-6 lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Top Publications by Citations
              </h2>
              <Link href="/publications" className="text-xs text-brand-600 hover:underline">
                View all →
              </Link>
            </div>

            {recentPublications.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                No publications yet — sync your data to get started
              </p>
            ) : (
              <div className="space-y-3">
                {recentPublications.map((pub) => (
                  <div key={pub.id} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{pub.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {pub.journalName ?? pub.venueName ?? "Unknown venue"} · {pub.year ?? "—"}
                        {pub.openAccess && (
                          <span className="ml-2 text-emerald-600 font-medium">Open Access</span>
                        )}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0 text-right">
                      <span className="text-sm font-bold text-gray-900 tabular-nums">
                        {formatNumber(pub.citationCount)}
                      </span>
                      <p className="text-xs text-gray-400">citations</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
