"use client";
// apps/web/app/check/confirm/page.tsx
// Step 3 (CRITICAL): Show candidate researcher profiles so the user can confirm
// their identity before we show their score. Without this step we'd show the
// wrong person's data — a serious trust and privacy issue.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Shape returned by our API's public researcher search (wraps OpenAlex)
interface CandidateProfile {
  id: string;           // OpenAlex ID, e.g. A5023888391
  displayName: string;
  institution?: string;
  country?: string;
  fields: string[];
  hIndex: number;
  citationCount: number;
  publicationCount: number;
  orcidId?: string;
  thumbnailUrl?: string;
  openAlexUrl: string;
}

type SearchState =
  | { status: "loading" }
  | { status: "results"; candidates: CandidateProfile[] }
  | { status: "empty" }
  | { status: "error"; message: string };

// ── Fetches candidates from our API, which proxies OpenAlex to avoid CORS ──
async function searchCandidates(
  mode: "name" | "orcid",
  query: string
): Promise<CandidateProfile[]> {
  const params = new URLSearchParams({ mode, q: query });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1/researchers/search?${params.toString()}`
  );
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json() as { success: boolean; data: CandidateProfile[] };
  if (!data.success) throw new Error("Search returned an error");
  return data.data;
}

export default function ConfirmPage() {
  const router = useRouter();
  const [searchState, setSearchState] = useState<SearchState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("rv_check");
    if (!raw) {
      router.replace("/check");
      return;
    }

    let parsed: { mode: "name" | "orcid"; query: string };
    try {
      parsed = JSON.parse(raw) as { mode: "name" | "orcid"; query: string };
    } catch {
      router.replace("/check");
      return;
    }

    searchCandidates(parsed.mode, parsed.query)
      .then((candidates) => {
        if (candidates.length === 0) {
          setSearchState({ status: "empty" });
        } else {
          setSearchState({ status: "results", candidates });
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Search failed";
        setSearchState({ status: "error", message });
      });
  }, [router]);

  function handleConfirm(candidate: CandidateProfile) {
    setSelectedId(candidate.id);
    // Store confirmed identity for the results page
    sessionStorage.setItem("rv_confirmed", JSON.stringify(candidate));
    router.push(`/check/results/${candidate.id}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-indigo-50 flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-brand-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Nav */}
      <nav
        className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto w-full"
        aria-label="Site navigation"
      >
        <Link href="/" className="text-xl font-bold text-brand-700 tracking-tight">
          Researchvy
        </Link>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1.5"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Change search
        </button>
      </nav>

      {/* Progress bar */}
      <div className="max-w-7xl mx-auto w-full px-8 mb-8" aria-hidden="true">
        <div className="flex items-center gap-2">
          {["Search", "Confirm identity", "View results"].map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${i <= 1 ? "text-brand-600" : "text-gray-400"}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  i < 1 ? "bg-brand-200 text-brand-700" :
                  i === 1 ? "bg-brand-600 text-white" :
                  "bg-gray-200 text-gray-500"
                }`}>
                  {i < 1 ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : i + 1}
                </span>
                {label}
              </div>
              {i < 2 && <div className={`flex-1 h-px ${i < 1 ? "bg-brand-300" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>
      </div>

      <main id="main" className="flex-1 px-8 pb-20 max-w-3xl mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
            Is this you?
          </h1>
          <p className="text-gray-500 text-sm">
            Select your profile to see your personalised visibility score.
            We found these matches in OpenAlex.
          </p>
        </div>

        {/* Loading state */}
        {searchState.status === "loading" && (
          <div className="space-y-4" aria-live="polite" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="flex gap-2 mt-2">
                      <div className="h-5 bg-gray-100 rounded-full w-16" />
                      <div className="h-5 bg-gray-100 rounded-full w-20" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-center text-sm text-gray-400 mt-3">
              Searching OpenAlex…
            </p>
          </div>
        )}

        {/* Results */}
        {searchState.status === "results" && (
          <div
            className="space-y-4"
            role="list"
            aria-label="Matching researcher profiles"
            aria-live="polite"
          >
            {searchState.candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                isSelected={selectedId === candidate.id}
                onConfirm={handleConfirm}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {searchState.status === "empty" && (
          <div
            className="card p-10 text-center"
            role="status"
            aria-live="polite"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">No matches found</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              We couldn&apos;t find a profile in OpenAlex. This can happen if your
              publications haven&apos;t been indexed yet, or if the spelling
              differs.
            </p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => router.back()}
                className="bg-brand-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Try a different name or ORCID
              </button>
              <Link
                href="/auth/register"
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Create a profile instead →
              </Link>
            </div>
          </div>
        )}

        {/* Error state */}
        {searchState.status === "error" && (
          <div
            className="card p-8 text-center border-red-200"
            role="alert"
          >
            <p className="text-sm font-medium text-red-700 mb-4">
              {searchState.message}
            </p>
            <button
              onClick={() => router.back()}
              className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Go back and try again
            </button>
          </div>
        )}

        {/* None of these / manual entry */}
        {(searchState.status === "results" || searchState.status === "empty") && (
          <div className="mt-6 card p-5 border-dashed">
            <p className="text-sm font-medium text-gray-700 mb-1">
              None of these are you?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              You can still create a free account and we&apos;ll build your
              profile from scratch as you publish more work.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/auth/register"
                className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Create account
              </Link>
              <button
                onClick={() => router.back()}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Search again
              </button>
            </div>
          </div>
        )}

        {/* Privacy note */}
        <p className="text-center text-xs text-gray-400 mt-8">
          Profile data sourced from{" "}
          <a
            href="https://openalex.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline"
          >
            OpenAlex
          </a>
          {" "}(public, open data). We don&apos;t store anything until you
          create an account.
        </p>
      </main>
    </div>
  );
}

// ── Candidate profile card ─────────────────────────────────────────────────

function CandidateCard({
  candidate,
  isSelected,
  onConfirm,
}: {
  candidate: CandidateProfile;
  isSelected: boolean;
  onConfirm: (c: CandidateProfile) => void;
}) {
  const initials = candidate.displayName
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <article
      role="listitem"
      className={`card p-5 transition-all ${
        isSelected ? "border-brand-400 bg-brand-50 shadow-md" : "hover:border-gray-300 hover:shadow-sm"
      }`}
      aria-label={`Researcher profile: ${candidate.displayName}`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 text-brand-700 font-bold text-sm"
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {candidate.displayName}
              </h2>
              {candidate.institution && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {candidate.institution}
                  {candidate.country && ` · ${candidate.country}`}
                </p>
              )}
            </div>
            {candidate.orcidId && (
              <span className="flex-shrink-0 text-xs bg-[#A6CE39]/20 text-[#5a7a0a] px-2 py-0.5 rounded-full font-medium">
                ORCID verified
              </span>
            )}
          </div>

          {/* Stats row */}
          <div
            className="flex items-center gap-4 mt-3"
            aria-label="Research metrics"
          >
            {[
              { label: "h-index", value: candidate.hIndex },
              { label: "citations", value: candidate.citationCount.toLocaleString() },
              { label: "publications", value: candidate.publicationCount },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-sm font-bold text-gray-900 tabular-nums">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Fields */}
          {candidate.fields.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3" aria-label="Research fields">
              {candidate.fields.slice(0, 4).map((f) => (
                <span
                  key={f}
                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                >
                  {f}
                </span>
              ))}
              {candidate.fields.length > 4 && (
                <span className="text-xs text-gray-400">
                  +{candidate.fields.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => onConfirm(candidate)}
          disabled={isSelected}
          aria-pressed={isSelected}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            isSelected
              ? "bg-brand-100 text-brand-700 cursor-default"
              : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {isSelected ? (
            <span className="flex items-center justify-center gap-1.5">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Loading your score…
            </span>
          ) : (
            "Yes, this is me →"
          )}
        </button>
        <a
          href={candidate.openAlexUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
          aria-label={`View ${candidate.displayName}'s OpenAlex profile (opens in new tab)`}
        >
          View on OpenAlex ↗
        </a>
      </div>
    </article>
  );
}
