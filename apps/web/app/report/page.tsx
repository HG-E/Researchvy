"use client";
// apps/web/app/report/page.tsx
// PDF-ready shareable visibility report.
//
// Print UX:
//   - CSS @media print styles in globals.css hide nav/buttons and show the report clean.
//   - Ctrl+P / window.print() produces a PDF that looks like a real document.
//   - Share link: unique URL with researcher's public OpenAlex ID.
//
// Layout mirrors a standard academic one-pager: name, institution, score, breakdown,
// top publications, key recommendations.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Navbar } from "@/components/ui/Navbar";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { ScoreBreakdown } from "@/components/dashboard/ScoreBreakdown";
import { useAuth } from "@/lib/auth-context";
import { dashboard } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/utils";
import type { DashboardData, VisibilityScoreBreakdown } from "@researchvy/shared";
import { getScoreBand } from "@researchvy/shared";
import Link from "next/link";

const fetcher = () =>
  dashboard.get().then((res) => {
    if (!res.success) throw new Error(res.error.message);
    return res.data;
  });

export default function ReportPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useSWR<DashboardData>("dashboard", fetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/auth/login");
  }, [authLoading, isAuthenticated, router]);

  function handlePrint() {
    window.print();
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/check/results/${data?.researcher.openAlexId ?? ""}`;
    await navigator.clipboard.writeText(url);
  }

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

  if (!data) return null;

  const { researcher, latestScore, recentPublications, pendingRecommendations } = data;
  const band = latestScore ? getScoreBand(latestScore.overallScore) : null;
  const highRecs = pendingRecommendations.filter((r) => r.impact === "HIGH").slice(0, 5);

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Screen-only toolbar */}
      <div className="print:hidden">
        <Navbar />
      </div>

      {/* Screen-only controls */}
      <div
        className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between print:hidden"
        aria-label="Report actions"
      >
        <div>
          <h1 className="text-xl font-bold text-gray-900">Visibility Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Print or share as a PDF — professional format, no Researchvy branding on the print version.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {researcher.openAlexId && (
            <button
              onClick={handleCopyLink}
              className="text-sm border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:border-gray-400 transition-colors flex items-center gap-1.5"
              aria-label="Copy shareable link to clipboard"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
              Copy share link
            </button>
          )}
          <button
            onClick={handlePrint}
            className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors font-medium flex items-center gap-1.5"
            aria-label="Download as PDF"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>

      {/* Report document */}
      <div
        ref={printRef}
        className="max-w-3xl mx-auto bg-white shadow-xl print:shadow-none print:max-w-none px-0"
        aria-label="Visibility report document"
        role="document"
      >
        {/* Report header */}
        <header className="px-10 py-10 border-b border-gray-200 print:px-0 print:py-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">
                {researcher.displayName}
              </h1>
              {researcher.institution && (
                <p className="text-base text-gray-600 mt-1">
                  {researcher.institution}
                  {researcher.department && `, ${researcher.department}`}
                  {researcher.country && ` · ${researcher.country}`}
                </p>
              )}
              {researcher.fields.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  {researcher.fields.join(" · ")}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3">
                {researcher.orcidId && (
                  <a
                    href={`https://orcid.org/${researcher.orcidId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 flex items-center gap-1"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                      style={{ backgroundColor: "#A6CE39" }}
                      aria-hidden="true"
                    >
                      iD
                    </span>
                    {researcher.orcidId}
                  </a>
                )}
                {researcher.websiteUrl && (
                  <a
                    href={researcher.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500"
                  >
                    {researcher.websiteUrl}
                  </a>
                )}
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-400 mb-2">Generated {today}</p>
              <p className="text-xs text-gray-400">
                Researchvy Visibility Report
              </p>
            </div>
          </div>
        </header>

        <div className="px-10 py-8 print:px-0 space-y-8">
          {/* Score section */}
          <section aria-labelledby="score-heading">
            <h2
              id="score-heading"
              className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5"
            >
              Visibility Score
            </h2>

            {latestScore ? (
              <div className="flex items-start gap-10">
                <div className="flex flex-col items-center flex-shrink-0">
                  <ScoreRing score={latestScore.overallScore} size={140} />
                  <p className="text-xs text-gray-400 mt-3">
                    Computed {formatDate(latestScore.computedAt)}
                  </p>
                </div>

                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[
                      { label: "h-index", value: researcher.hIndex },
                      { label: "Total citations", value: formatNumber(researcher.totalCitations) },
                      { label: "Publications", value: formatNumber(researcher.publicationCount) },
                      { label: "Score band", value: band?.label ?? "—" },
                    ].map((s) => (
                      <div key={s.label} className="bg-gray-50 rounded-lg px-4 py-3">
                        <p className="text-xs text-gray-500">{s.label}</p>
                        <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {researcher.bio && (
                    <p className="text-sm text-gray-600 leading-relaxed italic border-l-2 border-gray-200 pl-4">
                      &ldquo;{researcher.bio}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No score computed yet. Sync your publications to generate a score.</p>
            )}
          </section>

          {/* Score breakdown */}
          {latestScore && (
            <section aria-labelledby="breakdown-heading">
              <h2
                id="breakdown-heading"
                className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5 pb-3 border-b border-gray-100"
              >
                Score Breakdown
              </h2>
              <ScoreBreakdown breakdown={latestScore.breakdown as unknown as VisibilityScoreBreakdown} />
            </section>
          )}

          {/* Top publications */}
          {recentPublications.length > 0 && (
            <section aria-labelledby="publications-heading">
              <h2
                id="publications-heading"
                className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5 pb-3 border-b border-gray-100"
              >
                Top Publications by Citations
              </h2>
              <ol className="space-y-4" aria-label="Top publications">
                {recentPublications.slice(0, 5).map((pub, i) => (
                  <li key={pub.id} className="flex items-start gap-4">
                    <span
                      className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{pub.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {pub.journalName ?? pub.venueName ?? "Unknown venue"}
                        {pub.year && ` · ${pub.year}`}
                        {pub.doi && (
                          <>
                            {" · "}
                            <a
                              href={`https://doi.org/${pub.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-600 hover:underline"
                            >
                              doi.org/{pub.doi}
                            </a>
                          </>
                        )}
                        {pub.openAccess && (
                          <span className="ml-2 text-emerald-600 font-medium">Open Access</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        {formatNumber(pub.citationCount)}
                      </p>
                      <p className="text-xs text-gray-400">cites</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Priority recommendations */}
          {highRecs.length > 0 && (
            <section aria-labelledby="recs-heading">
              <h2
                id="recs-heading"
                className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5 pb-3 border-b border-gray-100"
              >
                Priority Recommendations
              </h2>
              <ol className="space-y-3" aria-label="High priority recommendations">
                {highRecs.map((rec, i) => (
                  <li key={rec.id} className="flex items-start gap-3">
                    <span
                      className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{rec.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Footer / attribution */}
          <footer className="pt-8 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <div>
              <p>
                Generated by{" "}
                <a href="https://researchvy.com" className="text-brand-600 hover:underline">
                  Researchvy
                </a>{" "}
                — Researcher Visibility Intelligence Platform
              </p>
              <p className="mt-0.5">
                Data sources: ORCID, OpenAlex (CC0). Methodology:{" "}
                <a href="https://researchvy.com/methodology" className="text-brand-600 hover:underline">
                  researchvy.com/methodology
                </a>
              </p>
            </div>
            <p>{today}</p>
          </footer>
        </div>
      </div>

      <div className="h-12 print:hidden" />
    </div>
  );
}
