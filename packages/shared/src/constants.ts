// packages/shared/src/constants.ts
// Shared constants used across API and Web.

// ─────────────────────────────────────────────────────────────────────────────
// VISIBILITY SCORE WEIGHTS
// These weights sum to 1.0.
// Changing these requires a new algorithmVersion in scoring service.
// ─────────────────────────────────────────────────────────────────────────────

export const SCORE_WEIGHTS = {
  citation:      0.30, // h-index + normalized citation count
  velocity:      0.20, // Citation growth rate (3-year rolling)
  policy:        0.25, // Policy document mentions — the "so what" factor
  openAccess:    0.10, // Accessibility of research
  collaboration: 0.15, // Co-author network reach
} as const;

// Algorithm version — bump when weights or formulas change materially
export const SCORE_ALGORITHM_VERSION = "1.0";

// ─────────────────────────────────────────────────────────────────────────────
// EXTERNAL API ENDPOINTS
// Centralized so both workers and services use the same URLs.
// ─────────────────────────────────────────────────────────────────────────────

export const EXTERNAL_APIS = {
  openAlex: {
    base: "https://api.openalex.org",
    // OpenAlex "polite pool" — add email for 10x higher rate limits
    // https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication
  },
  orcid: {
    // Override with ORCID_BASE_URL env var for sandbox
    base: "https://orcid.org",
    api: "https://pub.orcid.org/v3.0",
  },
  semanticScholar: {
    base: "https://api.semanticscholar.org/graph/v1",
  },
  crossref: {
    base: "https://api.crossref.org/works",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// SYNC SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

// How long to wait before allowing a manual re-sync (prevents API abuse)
export const MIN_SYNC_INTERVAL_MINUTES = 30;

// ─────────────────────────────────────────────────────────────────────────────
// SCORE LABELS
// UI-facing labels and thresholds for score bands.
// ─────────────────────────────────────────────────────────────────────────────

export const SCORE_BANDS = [
  { min: 0,  max: 20,  label: "Getting Started", color: "#94a3b8" },
  { min: 20, max: 40,  label: "Emerging",         color: "#60a5fa" },
  { min: 40, max: 60,  label: "Established",      color: "#34d399" },
  { min: 60, max: 80,  label: "Prominent",        color: "#fbbf24" },
  { min: 80, max: 100, label: "Highly Visible",   color: "#f97316" },
] as const;

export function getScoreBand(score: number) {
  return SCORE_BANDS.find((b) => score >= b.min && score < b.max) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}
