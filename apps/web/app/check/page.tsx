"use client";
// apps/web/app/check/page.tsx
// Step 2 of the user flow: enter name or ORCID to look up your visibility.
// This is the pre-auth "taste" — no account required to search.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

// ── ORCID format: 0000-0002-1825-0097 (16 digits, 4 groups separated by hyphens)
const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

type InputMode = "name" | "orcid";

export default function CheckPage() {
  const router = useRouter();
  const [mode, setMode] = useState<InputMode>("name");
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  function formatOrcid(raw: string): string {
    const digits = raw.replace(/[^0-9X]/gi, "");
    const groups = digits.match(/.{1,4}/g) ?? [];
    return groups.join("-").toUpperCase();
  }

  function handleOrcidInput(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatOrcid(e.target.value);
    if (formatted.length <= 19) setQuery(formatted);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "orcid") {
      if (!ORCID_PATTERN.test(query)) {
        setError("Enter a valid ORCID iD (e.g. 0000-0002-1825-0097)");
        return;
      }
    } else {
      if (query.trim().length < 3) {
        setError("Enter at least 3 characters to search");
        return;
      }
    }

    setIsSearching(true);

    // Store the search params for the confirm page
    sessionStorage.setItem(
      "rv_check",
      JSON.stringify({ mode, query: query.trim() })
    );

    router.push("/check/confirm");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-indigo-50 flex flex-col">
      {/* Skip to main content */}
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
        <Link
          href="/"
          className="text-xl font-bold text-brand-700 tracking-tight hover:text-brand-800 transition-colors"
          aria-label="Researchvy home"
        >
          Researchvy
        </Link>
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

      {/* Progress bar */}
      <div className="max-w-7xl mx-auto w-full px-8 mb-8" aria-hidden="true">
        <div className="flex items-center gap-2">
          {["Search", "Confirm identity", "View results"].map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  i === 0 ? "text-brand-600" : "text-gray-400"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0
                      ? "bg-brand-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {i + 1}
                </span>
                {label}
              </div>
              {i < 2 && (
                <div className="flex-1 h-px bg-gray-200" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <main
        id="main"
        className="flex-1 flex items-center justify-center px-8 pb-20"
      >
        <div className="w-full max-w-lg">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
              Check your research visibility
            </h1>
            <p className="text-gray-500 text-base leading-relaxed">
              Search by name or enter your ORCID iD — we&apos;ll find your
              profile and compute your score in seconds.
            </p>
          </div>

          <div className="card p-8">
            {/* Mode toggle */}
            <div
              className="flex bg-gray-100 rounded-lg p-1 mb-7"
              role="tablist"
              aria-label="Search method"
            >
              {(
                [
                  { id: "name", label: "Search by name" },
                  { id: "orcid", label: "I have an ORCID iD" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={mode === tab.id}
                  onClick={() => {
                    setMode(tab.id);
                    setQuery("");
                    setError("");
                  }}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
                    mode === tab.id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {mode === "name" ? (
                <div>
                  <label
                    htmlFor="name-search"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Full name
                  </label>
                  <input
                    id="name-search"
                    type="text"
                    autoComplete="off"
                    autoFocus
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setError("");
                    }}
                    placeholder="e.g. Jane Smith"
                    aria-describedby={error ? "search-error" : "name-hint"}
                    aria-invalid={!!error}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <p id="name-hint" className="text-xs text-gray-400 mt-1.5">
                    We search OpenAlex, the world&apos;s largest open research
                    index — 250M+ publications.
                  </p>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="orcid-search"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    ORCID iD
                  </label>
                  <div className="relative">
                    {/* ORCID logo */}
                    <div
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "#A6CE39" }}
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
                        <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.5 4.5c.828 0 1.5.672 1.5 1.5S8.328 7.5 7.5 7.5 6 6.828 6 6s.672-1.5 1.5-1.5zM9 19.5H6V9h3v10.5zm10.5 0H15v-5.7c0-3.547-4.5-3.281-4.5 0v5.7H6.75V9H10.5v1.725C11.7 8.52 19.5 8.36 19.5 14.7v4.8z" />
                      </svg>
                    </div>
                    <input
                      id="orcid-search"
                      type="text"
                      autoFocus
                      value={query}
                      onChange={handleOrcidInput}
                      placeholder="0000-0002-1825-0097"
                      maxLength={19}
                      aria-describedby={error ? "search-error" : "orcid-hint"}
                      aria-invalid={!!error}
                      className="w-full border border-gray-300 rounded-lg pl-11 pr-3.5 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    {query.length === 19 && ORCID_PATTERN.test(query) && (
                      <div
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500"
                        aria-label="Valid ORCID format"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p id="orcid-hint" className="text-xs text-gray-400 mt-1.5">
                    Find your ORCID at{" "}
                    <a
                      href="https://orcid.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      orcid.org
                    </a>{" "}
                    — it&apos;s free and takes 30 seconds to register.
                  </p>
                </div>
              )}

              {error && (
                <div
                  id="search-error"
                  role="alert"
                  className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-start gap-2"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSearching || query.trim().length < 3}
                aria-busy={isSearching}
                className="w-full bg-brand-600 text-white py-3 rounded-lg font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <>
                    <span
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                      aria-hidden="true"
                    />
                    Searching…
                  </>
                ) : (
                  "Find my profile →"
                )}
              </button>
            </form>

            {/* Trust signals */}
            <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-center gap-6 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-3.5 h-3.5 text-emerald-500"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
                No data stored without consent
              </span>
              <span className="flex items-center gap-1.5">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-3.5 h-3.5 text-brand-500"
                  aria-hidden="true"
                >
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No scraping
              </span>
              <span className="flex items-center gap-1.5">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-3.5 h-3.5 text-amber-500"
                  aria-hidden="true"
                >
                  <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.838 7.353A1 1 0 0117 16H3a1 1 0 01-.968-1.257l1.839-7.353-1.233-.617a1 1 0 01.894-1.789l1.599.8L9 4.323V3a1 1 0 011-1z" />
                </svg>
                Open data sources
              </span>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-brand-600 hover:underline font-medium"
            >
              Sign in to see your dashboard
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
