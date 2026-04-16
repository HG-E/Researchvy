// apps/api/src/services/orcid.ts
// ORCID OAuth2 + Public API integration.
//
// ORCID is the gold standard for researcher identity.
// We use it for:
//   1. OAuth login (user consents to share their profile)
//   2. Fetching their publication list (works)
//   3. Resolving institutional affiliation
//
// API docs: https://info.orcid.org/documentation/api-tutorials/

import { fetch } from "undici";

const ORCID_BASE = process.env["ORCID_BASE_URL"] ?? "https://orcid.org";
const ORCID_API = process.env["ORCID_API_URL"] ?? "https://pub.orcid.org/v3.0";
const CLIENT_ID = process.env["ORCID_CLIENT_ID"] ?? "";
const CLIENT_SECRET = process.env["ORCID_CLIENT_SECRET"] ?? "";
const REDIRECT_URI = process.env["ORCID_REDIRECT_URI"] ?? "";

// ─────────────────────────────────────────────────────────────────────────────
// OAUTH FLOW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the ORCID OAuth2 authorization URL.
 * The user is redirected here to grant consent.
 */
export function getOrcidAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    scope: "/authenticate /read-limited",
    redirect_uri: REDIRECT_URI,
    state,
  });
  return `${ORCID_BASE}/oauth/authorize?${params}`;
}

interface OrcidTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  orcid: string; // The researcher's ORCID iD
  name: string;
}

/**
 * Exchanges an OAuth authorization code for an access token.
 * Called after the user is redirected back from ORCID.
 */
export async function exchangeOrcidCode(code: string): Promise<OrcidTokenResponse> {
  const response = await fetch(`${ORCID_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ORCID token exchange failed: ${body}`);
  }

  return response.json() as Promise<OrcidTokenResponse>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export interface OrcidProfile {
  orcidId: string;
  name: string;
  biography?: string;
  institution?: string;
  country?: string;
  keywords: string[];
}

/**
 * Fetches a researcher's public ORCID profile.
 * Requires only the ORCID iD — no auth needed for public records.
 */
export async function fetchOrcidProfile(orcidId: string): Promise<OrcidProfile> {
  const res = await fetch(`${ORCID_API}/${orcidId}/person`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`ORCID profile fetch failed: ${res.status}`);

  // ORCID returns deeply nested JSON — we flatten it here
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;

  const givenName = data?.name?.["given-names"]?.value ?? "";
  const familyName = data?.name?.["family-name"]?.value ?? "";

  // Extract affiliation (employment)
  const employments = data?.activities?.["employments"]?.["affiliation-group"] ?? [];
  const latestEmployment = employments[0]?.summaries?.[0]?.["employment-summary"];
  const institution = latestEmployment?.organization?.name;

  // Extract country from address
  const country = data?.addresses?.address?.[0]?.country?.value;

  // Keywords as research fields
  const keywords: string[] = (data?.keywords?.keyword ?? [])
    .map((k: { content: string }) => k.content)
    .filter(Boolean);

  return {
    orcidId,
    name: `${givenName} ${familyName}`.trim() || "Unknown",
    biography: data?.biography?.content,
    institution,
    country,
    keywords,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — WORKS (PUBLICATIONS)
// ─────────────────────────────────────────────────────────────────────────────

export interface OrcidWork {
  title: string;
  doi?: string;
  year?: number;
  type: string;
  journalTitle?: string;
}

/**
 * Fetches the list of works (publications) for an ORCID iD.
 * Returns a summary list — we then enrich each paper via OpenAlex.
 */
export async function fetchOrcidWorks(orcidId: string): Promise<OrcidWork[]> {
  const res = await fetch(`${ORCID_API}/${orcidId}/works`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`ORCID works fetch failed: ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  const groups = data?.group ?? [];

  return groups.flatMap((group: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = group as any;
    const summary = g?.["work-summary"]?.[0];
    if (!summary) return [];

    // Extract DOI from external-ids
    const externalIds = summary?.["external-ids"]?.["external-id"] ?? [];
    const doi = externalIds.find(
      (id: { "external-id-type": string }) => id["external-id-type"] === "doi"
    )?.["external-id-value"];

    const year = summary?.["publication-date"]?.year?.value
      ? Number(summary["publication-date"].year.value)
      : undefined;

    return [{
      title: summary?.title?.title?.value ?? "Untitled",
      doi: doi?.toLowerCase().replace(/^https?:\/\/doi\.org\//, ""),
      year,
      type: summary?.type ?? "JOURNAL_ARTICLE",
      journalTitle: summary?.["journal-title"]?.value,
    }];
  });
}
