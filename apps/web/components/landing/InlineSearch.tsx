"use client";
// components/landing/InlineSearch.tsx
// Inline search form on the landing page hero.
// On submit, stores the query in sessionStorage and navigates to /check/confirm.
// Extracted as a client component so the landing page stays a server component.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InlineSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;

    // Detect ORCID format: 0000-0002-1825-0097
    const isOrcid = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(q);
    sessionStorage.setItem(
      "rv_check",
      JSON.stringify({ mode: isOrcid ? "orcid" : "name", query: q })
    );
    router.push("/check/confirm");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center max-w-xl mx-auto gap-2"
      role="search"
      aria-label="Search for your researcher profile"
    >
      <div className="flex-1 relative">
        <label htmlFor="hero-search" className="sr-only">
          Your name or ORCID iD
        </label>
        <input
          id="hero-search"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your name or ORCID iD…"
          className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>
      <button
        type="submit"
        disabled={query.trim().length < 2}
        className="bg-brand-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        Check visibility →
      </button>
    </form>
  );
}
