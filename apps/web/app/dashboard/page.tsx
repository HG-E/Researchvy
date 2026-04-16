"use client";
// apps/web/app/dashboard/page.tsx
// Main dashboard — researcher's home base after login.
// All data fetched in one request via /api/v1/dashboard.

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Navbar } from "@/components/ui/Navbar";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { ScoreBreakdown } from "@/components/dashboard/ScoreBreakdown";
import { ScoreHistoryChart } from "@/components/dashboard/ScoreHistoryChart";
import { SyncButton } from "@/components/dashboard/SyncButton";
import { PercentileBar } from "@/components/dashboard/PercentileBar";
import { PlatformPresence, buildPlatforms } from "@/components/dashboard/PlatformPresence";
import { GapCard } from "@/components/dashboard/GapCard";
import type { Gap } from "@/components/dashboard/GapCard";
import { useAuth } from "@/lib/auth-context";
import { dashboard, auth } from "@/lib/api";
import { formatNumber, formatDate } from "@/lib/utils";
import type { DashboardData, VisibilityScoreBreakdown, Recommendation } from "@researchvy/shared";
import Link from "next/link";

const fetcher = () =>
  dashboard.get().then((res) => {
    if (!res.success) throw new Error(res.error.message);
    return res.data;
  });

// Derive visibility gaps from dashboard data
function deriveGaps(data: DashboardData): Gap[] {
  const gaps: Gap[] = [];
  const { researcher, latestScore, recentPublications } = data;

  if (!researcher.orcidId) {
    gaps.push({
      id: "no-orcid",
      category: "platform",
      title: "ORCID not connected",
      description: "ORCID is the global researcher ID. Without it, citation databases can't reliably attribute your work to you.",
      severity: "high",
      actionLabel: "Connect ORCID",
      actionHref: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/orcid`,
    });
  }

  const closedAccessPapers = recentPublications.filter((p) => !p.openAccess).length;
  if (closedAccessPapers > 0) {
    gaps.push({
      id: "closed-access",
      category: "open_access",
      title: "Papers behind paywalls",
      description: "Open Access papers receive 50–200% more citations. Upload to arXiv or your institutional repository.",
      severity: closedAccessPapers >= 3 ? "high" : "medium",
      actionLabel: "See which papers",
      count: closedAccessPapers,
      actionHref: "/publications?filter=closed",
    });
  }

  if (!researcher.bio || researcher.bio.length < 50) {
    gaps.push({
      id: "incomplete-bio",
      category: "profile",
      title: "Bio is missing or too short",
      description: "A complete bio helps policy makers and journalists find and cite your work.",
      severity: "low",
      actionLabel: "Complete your profile",
      actionHref: "/profile/settings",
    });
  }

  if (latestScore && latestScore.policyScore < 30) {
    gaps.push({
      id: "low-policy",
      category: "policy",
      title: "No policy citations detected",
      description: "None of your publications appear in government or UN reports yet. Policy submissions can dramatically increase your impact score.",
      severity: "medium",
      actionLabel: "Find policy calls",
      actionHref: "/recommendations?type=policy",
    });
  }

  return gaps;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data, isLoading, mutate } = useSWR<DashboardData>("dashboard", fetcher, {
    revalidateOnFocus: false,
  });

  const orcidConnected = searchParams.get("orcid_connected");
  const orcidError = searchParams.get("orcid_error");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/auth/login");
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div
          className="flex items-center justify-center h-96"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            <p className="text-sm text-gray-500">Loading your dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { researcher, latestScore, scoreHistory, recentPublications, pendingRecommendations, activeSync } = data;
  const platforms = buildPlatforms(researcher);
  const gaps = deriveGaps(data);
  const highPriorityRecs = pendingRecommendations.filter((r) => r.impact === "HIGH");

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main id="main" className="max-w-7xl mx-auto px-6 py-8">
        {/* ── Status banners ── */}
        {orcidConnected && (
          <div
            role="status"
            className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            ORCID connected! We&apos;re fetching your publications — this may take a minute.
          </div>
        )}
        {orcidError && (
          <div role="alert" className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            ORCID connection failed: {orcidError}. Please try again.
          </div>
        )}

        {/* ── Page header ── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {researcher.displayName.split(" ")[0]}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {researcher.institution ?? "No institution set"} ·{" "}
              {researcher.publicationCount} publications · h-index: {researcher.hIndex}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/report"
              className="text-sm border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:border-gray-400 hover:bg-white transition-colors flex items-center gap-1.5"
              aria-label="Export visibility report"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
              </svg>
              Export report
            </Link>
            <SyncButton activeSync={activeSync} onComplete={() => mutate()} />
          </div>
        </div>

        {/* ── ORCID connect prompt ── */}
        {!researcher.orcidId && (
          <div
            className="mb-6 card p-5 border-brand-200 bg-brand-50 flex items-center justify-between"
            role="complementary"
            aria-label="ORCID connection prompt"
          >
            <div>
              <p className="font-semibold text-brand-900">Connect your ORCID profile</p>
              <p className="text-sm text-brand-700 mt-0.5">
                Get your full visibility score by linking ORCID — we&apos;ll import all your publications.
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

        {/* ── Row 1: Score + Percentile + Stats ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Visibility Score Card */}
          <div className="card p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-6">
              Visibility Score
            </h2>
            {latestScore ? (
              <div className="flex flex-col items-center gap-6">
                <ScoreRing score={latestScore.overallScore} />
                {/* Percentile */}
                <div className="w-full">
                  <PercentileBar
                    percentile={72}
                    field={researcher.fields[0]}
                    totalResearchers={2_400_000}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Last computed {formatDate(latestScore.computedAt)} · v{latestScore.algorithmVersion}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4" aria-hidden="true">
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600">No score yet</p>
                <p className="text-xs text-gray-400 mt-1">Connect ORCID and sync to compute</p>
              </div>
            )}
          </div>

          {/* Score Breakdown */}
          <div className="card p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Score Breakdown — Why?
              </h2>
              <Link
                href="/methodology"
                className="text-xs text-brand-600 hover:underline"
              >
                How scores work →
              </Link>
            </div>
            {latestScore ? (
              <ScoreBreakdown breakdown={latestScore.breakdown as unknown as VisibilityScoreBreakdown} />
            ) : (
              <p className="text-sm text-gray-400 py-8 text-center">
                Sync your publications to see a detailed breakdown
              </p>
            )}
          </div>
        </div>

        {/* ── Row 2: History + Key Metrics ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="card p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Score History</h2>
              <Link href="/history" className="text-xs text-brand-600 hover:underline">
                Full history →
              </Link>
            </div>
            <ScoreHistoryChart history={scoreHistory} />
          </div>

          <div className="card p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Key Metrics</h2>
            <dl className="space-y-4">
              {[
                { label: "Total Citations", value: formatNumber(researcher.totalCitations), icon: "📚" },
                { label: "h-index",         value: researcher.hIndex.toString(),             icon: "📊" },
                { label: "Publications",    value: formatNumber(researcher.publicationCount), icon: "📄" },
                { label: "Open Access",     value: `${recentPublications.filter((p) => p.openAccess).length}/${recentPublications.length}`, icon: "🔓" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true">{stat.icon}</span>
                    <dt className="text-sm text-gray-600">{stat.label}</dt>
                  </div>
                  <dd className="text-lg font-bold text-gray-900 tabular-nums">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* ── Row 3: Platform Presence + Gaps ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-5">
              Platform Presence
            </h2>
            <PlatformPresence platforms={platforms} />
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Visibility Gaps
              </h2>
              {gaps.length > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  {gaps.length} gap{gaps.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <GapCard gaps={gaps} />
          </div>
        </div>

        {/* ── Row 4: Recommendations ── */}
        {pendingRecommendations.length > 0 && (
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Priority Recommendations
              </h2>
              <div className="flex items-center gap-3">
                {highPriorityRecs.length > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    {highPriorityRecs.length} high impact
                  </span>
                )}
                <Link href="/recommendations" className="text-xs text-brand-600 hover:underline">
                  View all {pendingRecommendations.length} →
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingRecommendations.slice(0, 3).map((rec) => (
                <RecommendationCard key={rec.id} rec={rec} />
              ))}
            </div>
          </div>
        )}

        {/* ── Row 5: Top Publications ── */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
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
            <ul className="space-y-0" aria-label="Top publications">
              {recentPublications.map((pub) => (
                <li key={pub.id} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{pub.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {pub.journalName ?? pub.venueName ?? "Unknown venue"} · {pub.year ?? "—"}
                      {pub.openAccess && (
                        <span className="ml-2 text-emerald-600 font-medium" aria-label="Open Access">
                          Open Access
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-sm font-bold text-gray-900 tabular-nums">
                      {formatNumber(pub.citationCount)}
                    </span>
                    <p className="text-xs text-gray-400">citations</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Inline recommendation card (compact) ─────────────────────────────────────

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <article className="border border-gray-200 rounded-xl p-4 hover:border-brand-200 hover:bg-brand-50/30 transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-400 uppercase">
          {rec.type.replace(/_/g, " ")}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          rec.impact === "HIGH"   ? "bg-red-100 text-red-700" :
          rec.impact === "MEDIUM" ? "bg-amber-100 text-amber-700" :
                                    "bg-gray-100 text-gray-600"
        }`}>
          {rec.impact}
        </span>
      </div>
      <p className="text-sm font-semibold text-gray-800 mb-1">{rec.title}</p>
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{rec.body}</p>
      {rec.resourceUrl && (
        <a
          href={rec.resourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline"
          aria-label={`Learn more about: ${rec.title} (opens in new tab)`}
        >
          Learn more →
        </a>
      )}
    </article>
  );
}
