"use client";
// apps/web/app/recommendations/page.tsx
// Full recommendations list — filterable by type and impact level.
// Each card has dismiss + mark-done actions, resource links, and explanations.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Navbar } from "@/components/ui/Navbar";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/utils";
import type { Recommendation, RecommendationType, ImpactLevel } from "@researchvy/shared";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const TYPE_LABELS: Record<RecommendationType, string> = {
  OPEN_ACCESS:      "Open Access",
  POLICY_SUBMISSION: "Policy Submission",
  PREPRINT_UPLOAD:  "Preprint Upload",
  ORCID_COMPLETE:   "ORCID",
  PROFILE_COMPLETE: "Profile",
  COLLABORATION:    "Collaboration",
  CONFERENCE:       "Conference",
};

const TYPE_ICONS: Record<RecommendationType, string> = {
  OPEN_ACCESS:      "🔓",
  POLICY_SUBMISSION: "🏛️",
  PREPRINT_UPLOAD:  "📤",
  ORCID_COMPLETE:   "🆔",
  PROFILE_COMPLETE: "👤",
  COLLABORATION:    "🤝",
  CONFERENCE:       "🎓",
};

const IMPACT_SCORE_DELTA: Record<ImpactLevel, string> = {
  HIGH:   "+8–15 pts",
  MEDIUM: "+3–7 pts",
  LOW:    "+1–2 pts",
};

function fetchRecs(): Promise<Recommendation[]> {
  const token = document.cookie.match(/rv_token=([^;]+)/)?.[1];
  return fetch(`${API_URL}/api/v1/recommendations`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then((r) => r.json() as Promise<{ success: boolean; data: Recommendation[] }>)
    .then((d) => (d.success ? d.data : []));
}

async function updateRec(id: string, field: "isActioned" | "isDismissed", value: boolean): Promise<void> {
  const token = document.cookie.match(/rv_token=([^;]+)/)?.[1];
  await fetch(`${API_URL}/api/v1/recommendations/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ [field]: value }),
  });
}

export default function RecommendationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [typeFilter, setTypeFilter] = useState<RecommendationType | "ALL">(
    (searchParams.get("type")?.toUpperCase() as RecommendationType) ?? "ALL"
  );
  const [impactFilter, setImpactFilter] = useState<ImpactLevel | "ALL">("ALL");
  const [showActioned, setShowActioned] = useState(false);

  const { data: recs = [], isLoading, mutate } = useSWR<Recommendation[]>(
    "recommendations",
    fetchRecs,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/auth/login");
  }, [authLoading, isAuthenticated, router]);

  async function handleAction(id: string, field: "isActioned" | "isDismissed") {
    await updateRec(id, field, true);
    await mutate();
  }

  const filtered = recs.filter((r) => {
    if (!showActioned && (r.isActioned || r.isDismissed)) return false;
    if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
    if (impactFilter !== "ALL" && r.impact !== impactFilter) return false;
    return true;
  });

  const highCount = recs.filter((r) => !r.isActioned && !r.isDismissed && r.impact === "HIGH").length;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96" aria-busy="true" aria-live="polite">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main id="main" className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recommendations</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Prioritised actions to improve your visibility score
            </p>
          </div>
          {highCount > 0 && (
            <div
              className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm font-medium"
              role="status"
              aria-label={`${highCount} high impact recommendations`}
            >
              {highCount} high impact to action
            </div>
          )}
        </div>

        {/* Filters */}
        <div
          className="card p-4 mb-6 flex flex-wrap items-center gap-4"
          role="search"
          aria-label="Filter recommendations"
        >
          {/* Type filter */}
          <div>
            <label htmlFor="type-filter" className="text-xs font-medium text-gray-500 block mb-1">
              Type
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as RecommendationType | "ALL")}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="ALL">All types</option>
              {(Object.entries(TYPE_LABELS) as [RecommendationType, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Impact filter */}
          <div>
            <label htmlFor="impact-filter" className="text-xs font-medium text-gray-500 block mb-1">
              Impact
            </label>
            <div
              id="impact-filter"
              className="flex gap-1"
              role="group"
              aria-label="Filter by impact level"
            >
              {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setImpactFilter(level)}
                  aria-pressed={impactFilter === level}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    impactFilter === level
                      ? level === "HIGH"   ? "bg-red-600 text-white" :
                        level === "MEDIUM" ? "bg-amber-500 text-white" :
                        level === "LOW"    ? "bg-gray-500 text-white" :
                                             "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {level === "ALL" ? "All" : level.charAt(0) + level.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Show completed toggle */}
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="show-done" className="text-xs text-gray-500 cursor-pointer">
              Show completed
            </label>
            <button
              id="show-done"
              role="switch"
              aria-checked={showActioned}
              onClick={() => setShowActioned((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                showActioned ? "bg-brand-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  showActioned ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500 mb-4" aria-live="polite">
          {filtered.length} recommendation{filtered.length !== 1 ? "s" : ""}
          {typeFilter !== "ALL" && ` · ${TYPE_LABELS[typeFilter as RecommendationType]}`}
          {impactFilter !== "ALL" && ` · ${impactFilter} impact`}
        </p>

        {/* Recommendation list */}
        {filtered.length === 0 ? (
          <div className="card p-12 text-center" role="status">
            <p className="text-3xl mb-3" aria-hidden="true">🎉</p>
            <p className="text-lg font-semibold text-gray-800 mb-1">
              {recs.length === 0 ? "No recommendations yet" : "All done!"}
            </p>
            <p className="text-sm text-gray-500">
              {recs.length === 0
                ? "Sync your publications to generate personalised recommendations."
                : "You've actioned or dismissed all recommendations matching this filter."}
            </p>
          </div>
        ) : (
          <ul className="space-y-4" aria-label="Recommendations">
            {filtered.map((rec) => (
              <FullRecommendationCard
                key={rec.id}
                rec={rec}
                onAction={(field) => handleAction(rec.id, field)}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

// ── Full recommendation card ───────────────────────────────────────────────

function FullRecommendationCard({
  rec,
  onAction,
}: {
  rec: Recommendation;
  onAction: (field: "isActioned" | "isDismissed") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actioning, setActioning] = useState(false);

  const isDone = rec.isActioned || rec.isDismissed;

  async function handleClick(field: "isActioned" | "isDismissed") {
    setActioning(true);
    await onAction(field);
    setActioning(false);
  }

  return (
    <li
      className={`card transition-all ${isDone ? "opacity-60" : ""}`}
      aria-label={`${rec.impact} impact recommendation: ${rec.title}`}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0 mt-0.5" aria-hidden="true">
            {TYPE_ICONS[rec.type]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase mb-1">
                  {TYPE_LABELS[rec.type]}
                </p>
                <h2 className="text-sm font-semibold text-gray-900">{rec.title}</h2>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  rec.impact === "HIGH"   ? "bg-red-100 text-red-700" :
                  rec.impact === "MEDIUM" ? "bg-amber-100 text-amber-700" :
                                            "bg-gray-100 text-gray-600"
                }`}>
                  {rec.impact}
                </span>
                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                  {IMPACT_SCORE_DELTA[rec.impact]}
                </span>
              </div>
            </div>

            {/* Body */}
            <p className={`text-sm text-gray-600 mt-2 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
              {rec.body}
            </p>
            {rec.body.length > 120 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-brand-600 hover:underline mt-1"
                aria-expanded={expanded}
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">Added {formatDate(rec.createdAt)}</p>

          <div className="flex items-center gap-2">
            {!isDone && (
              <>
                <button
                  onClick={() => handleClick("isDismissed")}
                  disabled={actioning}
                  className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors disabled:opacity-50"
                  aria-label={`Dismiss recommendation: ${rec.title}`}
                >
                  Dismiss
                </button>
                {rec.resourceUrl && (
                  <a
                    href={rec.resourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-600 border border-brand-200 bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors font-medium"
                    aria-label={`Take action on: ${rec.title} (opens in new tab)`}
                  >
                    Take action ↗
                  </a>
                )}
                <button
                  onClick={() => handleClick("isActioned")}
                  disabled={actioning}
                  className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors font-medium disabled:opacity-50"
                  aria-label={`Mark as done: ${rec.title}`}
                >
                  {actioning ? "Saving…" : "Mark done"}
                </button>
              </>
            )}
            {isDone && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true">
                  <path fillRule="evenodd" d="M13.707 4.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L6 10.586l6.293-6.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {rec.isActioned ? "Done" : "Dismissed"}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
