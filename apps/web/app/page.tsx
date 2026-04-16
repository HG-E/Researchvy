// apps/web/app/page.tsx
// Marketing landing page — first thing non-authenticated visitors see.
// The primary CTA is the inline search form that flows into /check.

import type { Metadata } from "next";
import Link from "next/link";
import { InlineSearch } from "@/components/landing/InlineSearch";

export const metadata: Metadata = {
  title: "Researchvy — Check Your Research Visibility",
  description:
    "Discover how visible your research really is. Enter your name or ORCID and get a free visibility score across citation impact, policy influence, open access rate, and more.",
  keywords: ["research visibility", "academic impact", "ORCID", "h-index", "citation score", "researcher profile"],
  openGraph: {
    title: "Researchvy — Research Visibility Intelligence",
    description: "Get your free research visibility score. Powered by ORCID and OpenAlex.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Researchvy — Research Visibility Score",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Check your research visibility — free",
    description: "Powered by ORCID and OpenAlex. Transparent, explainable score in minutes.",
  },
};

const SCORE_PREVIEW = [
  { label: "Citation Impact",     score: 78, color: "#6366f1", weight: "30%" },
  { label: "Policy Influence",    score: 65, color: "#10b981", weight: "25%" },
  { label: "Citation Velocity",   score: 55, color: "#3b82f6", weight: "20%" },
  { label: "Collaboration Reach", score: 72, color: "#8b5cf6", weight: "15%" },
  { label: "Open Access Rate",    score: 80, color: "#f59e0b", weight: "10%" },
];

const TRUST_BADGES = [
  { label: "ORCID",     bg: "#A6CE39", initials: "iD",  desc: "Verified identity" },
  { label: "OpenAlex",  bg: "#6366f1", initials: "OA",  desc: "250M+ publications" },
  { label: "CrossRef",  bg: "#ef4444", initials: "CR",  desc: "DOI metadata" },
];

const STEPS = [
  {
    step: "01",
    title: "Enter your name or ORCID",
    body: "No account needed to get started. We search OpenAlex, the world's largest open research database.",
  },
  {
    step: "02",
    title: "Confirm your identity",
    body: "We show candidate profiles so you can confirm it's really you — never the wrong person's data.",
  },
  {
    step: "03",
    title: "Get your score & act",
    body: "A transparent 0–100 score across 5 dimensions, with concrete steps to improve it.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-indigo-50">
      {/* Skip nav */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-brand-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Nav */}
      <nav
        className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto"
        aria-label="Site navigation"
      >
        <span className="text-xl font-bold text-brand-700 tracking-tight" aria-label="Researchvy">
          Researchvy
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/auth/login"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main id="main">
        <section
          className="max-w-4xl mx-auto px-8 pt-16 pb-12 text-center"
          aria-labelledby="hero-heading"
        >
          {/* Trust pill */}
          <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" aria-hidden="true" />
            Free for individual researchers · No credit card
          </div>

          <h1
            id="hero-heading"
            className="text-5xl font-extrabold text-gray-900 leading-tight mb-5"
          >
            How visible is
            <br />
            <span className="text-brand-600">your research, really?</span>
          </h1>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-3 leading-relaxed">
            Enter your name or ORCID. We&apos;ll compute a transparent, explainable
            visibility score in seconds — and tell you exactly how to improve it.
          </p>

          {/* Data source trust logos */}
          <div
            className="flex items-center justify-center gap-3 mb-10"
            aria-label="Data sources"
          >
            <span className="text-xs text-gray-400">Powered by</span>
            {TRUST_BADGES.map((b) => (
              <div key={b.label} className="flex items-center gap-1.5" title={b.desc}>
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ backgroundColor: b.bg }}
                  aria-hidden="true"
                >
                  {b.initials}
                </div>
                <span className="text-xs text-gray-500 font-medium">{b.label}</span>
              </div>
            ))}
          </div>

          {/* ── Inline search form (client component) ── */}
          <InlineSearch />
        </section>

        {/* Score preview card */}
        <section
          className="max-w-5xl mx-auto px-8 pb-20"
          aria-label="Example visibility score"
        >
          <div className="card p-8 shadow-xl">
            <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-6">
              Example score — what you&apos;ll receive
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Score ring */}
              <div className="flex flex-col items-center justify-center py-4" aria-hidden="true">
                <div className="relative w-36 h-36">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50"
                      fill="none" stroke="#6366f1" strokeWidth="10"
                      strokeDasharray="314" strokeDashoffset="94"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-gray-900">70</span>
                    <span className="text-xs text-gray-500">/ 100</span>
                  </div>
                </div>
                <p className="mt-3 font-semibold text-gray-800">Visibility Score</p>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mt-1 font-medium">
                  Prominent
                </span>
                <p className="text-xs text-gray-400 mt-2">Top 28% in your field</p>
              </div>

              {/* Breakdown */}
              <div className="col-span-2 space-y-4" aria-label="Score breakdown">
                {SCORE_PREVIEW.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{item.label}</span>
                      <span className="text-gray-500 tabular-nums font-mono">
                        {item.score}/100 · {item.weight}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${item.score}%`, backgroundColor: item.color }}
                        role="progressbar"
                        aria-valuenow={item.score}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${item.label}: ${item.score} out of 100`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="bg-white py-20"
          aria-labelledby="how-heading"
        >
          <div className="max-w-5xl mx-auto px-8">
            <h2
              id="how-heading"
              className="text-3xl font-bold text-center text-gray-900 mb-3"
            >
              Three steps to clarity
            </h2>
            <p className="text-center text-gray-500 text-base mb-12 max-w-xl mx-auto">
              No account required for the first look. Create one to save your
              results, track history, and get personalised recommendations.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {STEPS.map((item) => (
                <div key={item.step} className="card p-6">
                  <span className="text-3xl font-black text-brand-200" aria-hidden="true">
                    {item.step}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900 mt-3 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust / transparency section */}
        <section
          className="py-20 max-w-5xl mx-auto px-8"
          aria-labelledby="trust-heading"
        >
          <h2
            id="trust-heading"
            className="text-3xl font-bold text-center text-gray-900 mb-12"
          >
            Built on open science principles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "🔓",
                title: "Open data, only",
                body: "We never scrape. All data comes from ORCID and OpenAlex — both CC0 licensed, consent-first platforms.",
              },
              {
                icon: "📐",
                title: "Transparent methodology",
                body: "Every number in your score is explainable. Read our full algorithm documentation — no black boxes.",
              },
              {
                icon: "🛡️",
                title: "Privacy by design",
                body: "We don't store your data without consent. The public search is ephemeral — nothing saved until you sign up.",
              },
              {
                icon: "🆓",
                title: "Free for researchers",
                body: "Individual researcher accounts are free forever. We charge institutions, not individuals.",
              },
              {
                icon: "🤝",
                title: "ORCID-first",
                body: "ORCID is the gold standard for researcher identity. We verify against it, not just publication matches.",
              },
              {
                icon: "📬",
                title: "No spam, ever",
                body: "We'll only email you when your score changes or a high-priority recommendation appears.",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4">
                <span className="text-2xl flex-shrink-0" aria-hidden="true">{item.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-brand-600 py-16 text-center" aria-labelledby="cta-heading">
          <div className="max-w-2xl mx-auto px-8">
            <h2
              id="cta-heading"
              className="text-3xl font-extrabold text-white mb-4"
            >
              Check your visibility now
            </h2>
            <p className="text-brand-200 text-base mb-8">
              Takes 30 seconds. No account required for the first look.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/check"
                className="bg-white text-brand-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-brand-50 transition-colors shadow-lg"
              >
                Check my visibility →
              </Link>
              <Link
                href="/auth/register"
                className="text-brand-100 hover:text-white font-medium transition-colors text-sm"
              >
                Create free account
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 text-center text-sm text-gray-400 bg-white border-t border-gray-100">
        <p className="mb-2">
          Researchvy · Built for researchers, by researchers
        </p>
        <div className="flex items-center justify-center gap-6 text-xs">
          <Link href="/methodology" className="hover:text-gray-600 transition-colors">Methodology</Link>
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
          <a
            href="https://github.com/HG-E/Researchvy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600 transition-colors"
          >
            GitHub
          </a>
        </div>
        <p className="mt-3 text-xs">
          Data: ORCID (CC0) · OpenAlex (CC0) · CrossRef (free tier)
        </p>
      </footer>
    </div>
  );
}
