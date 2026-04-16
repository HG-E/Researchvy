"use client";
// apps/web/app/check/results/[id]/page.tsx
// Step 4 (public): Visibility score preview for a confirmed identity.
// Shows teaser data to drive sign-up; full dashboard requires an account.
//
// The [id] is an OpenAlex researcher ID. We fetch public data from our API.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ScoreRing } from "@/components/dashboard/ScoreRing";

interface PublicProfile {
  id: string;
  displayName: string;
  institution?: string;
  country?: string;
  fields: string[];
  hIndex: number;
  citationCount: number;
  publicationCount: number;
  orcidId?: string;
  overallScore: number;
  percentile: number;
  scoreBand: string;
  scoreBreakdown: {
    label: string;
    score: number;
    color: string;
    weight: number;
  }[];
  gaps: string[];
  topPublication?: {
    title: string;
    year?: number;
    citationCount: number;
    openAccess: boolean;
  };
}

type PageState =
  | { status: "loading" }
  | { status: "ready"; profile: PublicProfile }
  | { status: "error" };

async function fetchPublicProfile(id: string): Promise<PublicProfile> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1/researchers/public/${id}`
  );
  if (!res.ok) throw new Error("Not found");
  const data = await res.json() as { success: boolean; data: PublicProfile };
  if (!data.success) throw new Error("Failed");
  return data.data;
}

export default function PublicResultsPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params["id"] === "string" ? params["id"] : "";
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    if (!id) return;
    fetchPublicProfile(id)
      .then((profile) => setState({ status: "ready", profile }))
      .catch(() => setState({ status: "error" }));
  }, [id]);

  if (state.status === "loading") {
    return (
      <PageShell>
        <div
          className="flex flex-col items-center justify-center py-20 gap-4"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Computing your visibility score…</p>
        </div>
      </PageShell>
    );
  }

  if (state.status === "error") {
    return (
      <PageShell>
        <div className="card p-10 text-center" role="alert">
          <p className="text-gray-600 mb-4">We couldn&apos;t load this profile.</p>
          <button
            onClick={() => router.push("/check")}
            className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </PageShell>
    );
  }

  const { profile } = state;

  return (
    <PageShell>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4 text-brand-700 font-bold text-xl">
          {profile.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900">{profile.displayName}</h1>
        {profile.institution && (
          <p className="text-gray-500 text-sm mt-1">
            {profile.institution}
            {profile.country && ` · ${profile.country}`}
          </p>
        )}
        {profile.fields.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center mt-2">
            {profile.fields.slice(0, 3).map((f) => (
              <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Score + percentile */}
      <div className="card p-8 mb-6 text-center">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-6">
          Visibility Score
        </h2>
        <div className="flex flex-col md:flex-row items-center justify-center gap-10">
          <ScoreRing score={profile.overallScore} size={160} />
          <div className="space-y-4 text-left">
            <div>
              <p className="text-3xl font-extrabold text-gray-900 tabular-nums">
                Top {100 - profile.percentile}%
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                of researchers in your field
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "h-index", value: profile.hIndex },
                { label: "citations", value: profile.citationCount.toLocaleString() },
                { label: "papers", value: profile.publicationCount },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-xl font-bold text-gray-900 tabular-nums">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Score breakdown teaser */}
      <div className="card p-6 mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-5">
          Score Breakdown
        </h2>
        <div className="space-y-4">
          {profile.scoreBreakdown.map((component) => (
            <div key={component.label}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium text-gray-700">{component.label}</span>
                <span className="text-gray-500 tabular-nums font-mono">{component.score}/100</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${component.score}%`, backgroundColor: component.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gaps teaser (blurred) */}
      {profile.gaps.length > 0 && (
        <div className="card p-6 mb-6 relative overflow-hidden">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Identified Gaps
          </h2>
          <ul className="space-y-2">
            {profile.gaps.map((gap, i) => (
              <li key={i} className={`flex items-start gap-2 text-sm ${i > 0 ? "blur-sm select-none" : ""}`}>
                <span className="text-amber-500 mt-0.5" aria-hidden="true">▲</span>
                <span className={i > 0 ? "text-gray-300" : "text-gray-700"}>{gap}</span>
              </li>
            ))}
          </ul>
          {profile.gaps.length > 1 && (
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent flex items-end justify-center pb-4">
              <p className="text-xs text-gray-500 font-medium">
                {profile.gaps.length - 1} more gap{profile.gaps.length > 2 ? "s" : ""} — sign up to see all
              </p>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="card p-8 bg-brand-50 border-brand-200 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Save your results &amp; track progress
        </h2>
        <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto">
          Create a free account to unlock full recommendations, history tracking,
          ORCID sync, and a shareable report.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/auth/register?from=check&openAlexId=${profile.id}`}
            className="bg-brand-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200 w-full sm:w-auto text-center"
          >
            Save my results — free →
          </Link>
          <Link
            href="/auth/login"
            className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            I already have an account
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          No credit card required. Free forever for individual researchers.
        </p>
      </div>

      {/* Data attribution */}
      <p className="text-center text-xs text-gray-400 mt-6">
        Score computed from{" "}
        <a href="https://openalex.org" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
          OpenAlex
        </a>{" "}
        data · Methodology is{" "}
        <Link href="/methodology" className="text-brand-600 hover:underline">
          fully transparent
        </Link>
      </p>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-indigo-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-brand-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <nav
        className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto"
        aria-label="Site navigation"
      >
        <Link href="/" className="text-xl font-bold text-brand-700 tracking-tight">
          Researchvy
        </Link>
        <Link
          href="/auth/register"
          className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors font-medium"
        >
          Get started free
        </Link>
      </nav>
      <main id="main" className="max-w-2xl mx-auto px-8 py-8 pb-20">
        {children}
      </main>
    </div>
  );
}
