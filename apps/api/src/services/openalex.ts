// apps/api/src/services/openalex.ts
// OpenAlex API integration — our primary source for citations and policy impact.
//
// Why OpenAlex?
//   - Fully open, no paid API key required
//   - 250M+ works, 90M+ authors
//   - Includes policy citations (via "grants" + "concepts")
//   - Better than Semantic Scholar for non-CS fields
//
// Docs: https://docs.openalex.org
// Polite pool: add email param for 10x higher rate limits

import { fetch } from "undici";

const BASE_URL = "https://api.openalex.org";
// Add email for polite pool (recommended by OpenAlex docs)
const MAILTO = process.env["OPENALEX_EMAIL"] ?? "";

function politeParam() {
  return MAILTO ? `mailto=${encodeURIComponent(MAILTO)}` : "";
}

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (MAILTO) url.searchParams.set("mailto", MAILTO);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHOR LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenAlexAuthor {
  id: string;         // e.g., "https://openalex.org/A1234567890"
  openAlexId: string; // e.g., "A1234567890"
  displayName: string;
  hIndex: number;
  citationsCount: number;
  worksCount: number;
  institution?: string;
}

/**
 * Finds an OpenAlex author by ORCID iD.
 * Returns null if not found.
 */
export async function findAuthorByOrcid(
  orcidId: string
): Promise<OpenAlexAuthor | null> {
  const url = buildUrl("/authors", {
    filter: `orcid:${orcidId}`,
    select: "id,display_name,summary_stats,last_known_institution",
  });

  const res = await fetch(url, {
    headers: { "User-Agent": `Researchvy/1.0 (mailto:${MAILTO})` },
  });
  if (!res.ok) throw new Error(`OpenAlex author search failed: ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  const results = data?.results ?? [];
  if (results.length === 0) return null;

  return parseAuthor(results[0]);
}

/**
 * Fetches a specific OpenAlex author by their OpenAlex ID.
 */
export async function getAuthorById(
  openAlexId: string
): Promise<OpenAlexAuthor | null> {
  const url = buildUrl(`/authors/${openAlexId}`);
  const res = await fetch(url, {
    headers: { "User-Agent": `Researchvy/1.0 (${politeParam()})` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OpenAlex author fetch failed: ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  return parseAuthor(data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAuthor(raw: any): OpenAlexAuthor {
  const id: string = raw.id ?? "";
  return {
    id,
    openAlexId: id.replace("https://openalex.org/", ""),
    displayName: raw.display_name ?? "",
    hIndex: raw.summary_stats?.h_index ?? 0,
    citationsCount: raw.summary_stats?.cited_by_count ?? 0,
    worksCount: raw.works_count ?? 0,
    institution: raw.last_known_institution?.display_name,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKS (PUBLICATIONS)
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenAlexWork {
  id: string;
  openAlexId: string;
  doi?: string;
  title: string;
  abstract?: string;
  year?: number;
  type: string;
  citationCount: number;
  openAccess: boolean;
  openAccessUrl?: string;
  journalName?: string;
  coAuthors: Array<{ name: string; openAlexId?: string; orcidId?: string }>;
}

/**
 * Fetches all works for an author from OpenAlex.
 * Handles pagination automatically.
 */
export async function fetchAuthorWorks(
  openAlexId: string,
  maxPages = 10
): Promise<OpenAlexWork[]> {
  const works: OpenAlexWork[] = [];
  let cursor = "*"; // OpenAlex cursor-based pagination

  for (let page = 0; page < maxPages; page++) {
    const url = buildUrl(`/works`, {
      filter: `author.id:${openAlexId}`,
      select: [
        "id",
        "doi",
        "title",
        "abstract_inverted_index",
        "publication_year",
        "type",
        "cited_by_count",
        "open_access",
        "primary_location",
        "authorships",
      ].join(","),
      per_page: "100",
      cursor,
    });

    const res = await fetch(url, {
      headers: { "User-Agent": `Researchvy/1.0 (${politeParam()})` },
    });
    if (!res.ok) throw new Error(`OpenAlex works fetch failed: ${res.status}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any;
    const results = data?.results ?? [];
    const nextCursor = data?.meta?.next_cursor;

    works.push(...results.map(parseWork));

    if (!nextCursor || results.length === 0) break;
    cursor = nextCursor;
  }

  return works;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseWork(raw: any): OpenAlexWork {
  const id: string = raw.id ?? "";

  // Reconstruct abstract from inverted index
  // OpenAlex stores abstracts as inverted word→position maps to save space
  let abstract: string | undefined;
  if (raw.abstract_inverted_index) {
    const positions: Array<[number, string]> = [];
    for (const [word, pos] of Object.entries(raw.abstract_inverted_index)) {
      for (const p of pos as number[]) {
        positions.push([p, word]);
      }
    }
    abstract = positions.sort((a, b) => a[0] - b[0]).map(([, w]) => w).join(" ");
  }

  // Co-authors (excluding the primary author themselves — they'll be linked)
  const coAuthors = (raw.authorships ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((a: any) => ({
      name: a.author?.display_name ?? "",
      openAlexId: (a.author?.id ?? "").replace("https://openalex.org/", ""),
      orcidId: a.author?.orcid?.replace("https://orcid.org/", ""),
    }))
    .filter((a: { name: string }) => Boolean(a.name));

  return {
    id,
    openAlexId: id.replace("https://openalex.org/", ""),
    doi: raw.doi?.replace("https://doi.org/", ""),
    title: raw.title ?? "Untitled",
    abstract,
    year: raw.publication_year,
    type: mapWorkType(raw.type),
    citationCount: raw.cited_by_count ?? 0,
    openAccess: raw.open_access?.is_oa ?? false,
    openAccessUrl: raw.open_access?.oa_url,
    journalName: raw.primary_location?.source?.display_name,
    coAuthors,
  };
}

function mapWorkType(type: string): string {
  const map: Record<string, string> = {
    article: "JOURNAL_ARTICLE",
    "proceedings-article": "CONFERENCE_PAPER",
    "book-chapter": "BOOK_CHAPTER",
    book: "BOOK",
    preprint: "PREPRINT",
    dissertation: "THESIS",
    dataset: "DATASET",
    report: "REPORT",
  };
  return map[type] ?? "OTHER";
}

// ─────────────────────────────────────────────────────────────────────────────
// POLICY MENTIONS
// OpenAlex tracks which works cite a given paper.
// We filter for "policy" sources using the "type" field on concepts.
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenAlexPolicyMention {
  policyTitle: string;
  policyUrl?: string;
  policyType: string;
  country?: string;
  year?: number;
  organization?: string;
}

/**
 * Searches for policy documents that cite a given work.
 * Uses OpenAlex's concept filtering for policy-related sources.
 *
 * Note: OpenAlex policy data is improving — this will become more accurate
 * over time. For now, we filter by source type = "repository" with policy concepts.
 */
export async function fetchPolicyMentions(
  openAlexWorkId: string
): Promise<OpenAlexPolicyMention[]> {
  // Find works that cite this paper AND are classified as policy/government
  const url = buildUrl("/works", {
    filter: [
      `cites:${openAlexWorkId}`,
      "primary_location.source.type:repository",
      "concepts.id:C2779455604", // OpenAlex concept ID for "Policy"
    ].join(","),
    select: "id,title,doi,publication_year,primary_location,institutions",
    per_page: "50",
  });

  const res = await fetch(url, {
    headers: { "User-Agent": `Researchvy/1.0 (${politeParam()})` },
  });
  if (!res.ok) return []; // Policy data is best-effort

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  const results = data?.results ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return results.map((r: any): OpenAlexPolicyMention => ({
    policyTitle: r.title ?? "Untitled Policy Document",
    policyUrl: r.doi ? `https://doi.org/${r.doi}` : r.primary_location?.landing_page_url,
    policyType: "OTHER", // Would need more signals to classify better
    year: r.publication_year,
    organization: r.primary_location?.source?.display_name,
  }));
}
