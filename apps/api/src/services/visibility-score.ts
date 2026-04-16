// apps/api/src/services/visibility-score.ts
// Computes the Researchvy Visibility Score for a researcher.
//
// Design principles:
//   - Every number is explainable — we generate a human-readable breakdown
//   - Scores are normalized to 0–100 relative to reasonable field baselines
//   - Algorithm is versioned so old scores aren't compared to new ones
//   - Pure functions where possible — easier to test and reason about

import type { PrismaClient } from "@prisma/client";
import {
  SCORE_WEIGHTS,
  SCORE_ALGORITHM_VERSION,
} from "@researchvy/shared";
import type {
  VisibilityScoreBreakdown,
  ScoreComponentBreakdown,
} from "@researchvy/shared";

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZATION BASELINES
// These are reasonable targets for an "established" researcher.
// A researcher who hits these gets roughly 70-80/100.
// We deliberately set them achievable — not world-class — to be encouraging.
// ─────────────────────────────────────────────────────────────────────────────

const BASELINES = {
  hIndex: 15,          // h-index of 15 = solid mid-career researcher
  totalCitations: 500, // 500 citations is respectable across most fields
  // For velocity: 50 new citations/year = healthy growing work
  yearlyNewCitations: 50,
  // Policy: even 1 policy mention is notable; 10 = highly policy-relevant
  policyMentions: 10,
  // Open access: 100% is the goal
  openAccessRate: 1.0,
  // Collaboration: 20 unique co-authors over career = well-networked
  uniqueCoAuthors: 20,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCORING FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export async function computeVisibilityScore(
  prisma: PrismaClient,
  researcherId: string
): Promise<{
  overallScore: number;
  citationScore: number;
  velocityScore: number;
  policyScore: number;
  openAccessScore: number;
  collaborationScore: number;
  breakdown: VisibilityScoreBreakdown;
}> {
  // Load all data in parallel — avoid N+1 queries
  const [researcher, publications, policyMentions] = await Promise.all([
    prisma.researcher.findUniqueOrThrow({ where: { id: researcherId } }),
    prisma.publication.findMany({ where: { researcherId } }),
    prisma.policyMention.findMany({
      where: { publication: { researcherId } },
    }),
  ]);

  // ── Component 1: Citation Score ──────────────────────────────────────────
  const citationComponent = computeCitationScore(
    researcher.hIndex,
    researcher.totalCitations
  );

  // ── Component 2: Velocity Score ──────────────────────────────────────────
  // How quickly is this researcher accumulating new citations?
  const citationComponent2 = computeVelocityScore(publications);

  // ── Component 3: Policy Score ─────────────────────────────────────────────
  const policyComponent = computePolicyScore(policyMentions);

  // ── Component 4: Open Access Score ───────────────────────────────────────
  const openAccessComponent = computeOpenAccessScore(publications);

  // ── Component 5: Collaboration Score ─────────────────────────────────────
  const collaborationComponent = computeCollaborationScore(publications);

  // ── Composite Score (weighted sum) ───────────────────────────────────────
  const overallScore = Math.round(
    citationComponent.score * SCORE_WEIGHTS.citation +
    citationComponent2.score * SCORE_WEIGHTS.velocity +
    policyComponent.score * SCORE_WEIGHTS.policy +
    openAccessComponent.score * SCORE_WEIGHTS.openAccess +
    collaborationComponent.score * SCORE_WEIGHTS.collaboration
  );

  const breakdown: VisibilityScoreBreakdown = {
    citation:      citationComponent,
    velocity:      citationComponent2,
    policy:        policyComponent,
    openAccess:    openAccessComponent,
    collaboration: collaborationComponent,
  };

  return {
    overallScore,
    citationScore:      citationComponent.score,
    velocityScore:      citationComponent2.score,
    policyScore:        policyComponent.score,
    openAccessScore:    openAccessComponent.score,
    collaborationScore: collaborationComponent.score,
    breakdown,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT FUNCTIONS
// Each returns a ScoreComponentBreakdown with score + explanation.
// ─────────────────────────────────────────────────────────────────────────────

function computeCitationScore(
  hIndex: number,
  totalCitations: number
): ScoreComponentBreakdown {
  // Combine h-index and total citations with equal weighting.
  // Both are normalized against baselines and capped at 100.
  const hScore = Math.min((hIndex / BASELINES.hIndex) * 100, 100);
  const cScore = Math.min((totalCitations / BASELINES.totalCitations) * 100, 100);
  const score = Math.round((hScore + cScore) / 2);

  return {
    score,
    weight: SCORE_WEIGHTS.citation,
    contribution: Math.round(score * SCORE_WEIGHTS.citation),
    explanation: `Your h-index of ${hIndex} and ${totalCitations.toLocaleString()} total citations reflect your research impact.`,
    dataPoints: [
      `h-index: ${hIndex} (baseline: ${BASELINES.hIndex})`,
      `Total citations: ${totalCitations.toLocaleString()} (baseline: ${BASELINES.totalCitations.toLocaleString()})`,
    ],
  };
}

function computeVelocityScore(
  publications: Array<{ year: number | null; citationCount: number }>
): ScoreComponentBreakdown {
  // Estimate yearly new citations from publications in the last 3 years.
  // We don't have year-by-year citation data from all sources, so we
  // approximate from recent paper citation counts.
  const currentYear = new Date().getFullYear();
  const recentPubs = publications.filter(
    (p) => p.year !== null && p.year >= currentYear - 3
  );

  const recentCitations = recentPubs.reduce((sum, p) => sum + p.citationCount, 0);
  // Rough annualized rate over 3 years
  const estimatedYearlyRate = Math.round(recentCitations / 3);

  const score = Math.min(
    Math.round((estimatedYearlyRate / BASELINES.yearlyNewCitations) * 100),
    100
  );

  return {
    score,
    weight: SCORE_WEIGHTS.velocity,
    contribution: Math.round(score * SCORE_WEIGHTS.velocity),
    explanation: `Your recent publications are accumulating ~${estimatedYearlyRate} citations/year, showing ${score >= 60 ? "strong" : "developing"} momentum.`,
    dataPoints: [
      `${recentPubs.length} publications in last 3 years`,
      `~${estimatedYearlyRate} estimated citations/year`,
      `Baseline: ${BASELINES.yearlyNewCitations} citations/year`,
    ],
  };
}

function computePolicyScore(
  policyMentions: Array<{ policyType: string }>
): ScoreComponentBreakdown {
  // Weight policy mentions by document type — a UN report citation is
  // worth more than a general NGO report.
  const typeWeights: Record<string, number> = {
    UN_REPORT:   3.0,
    GOVERNMENT:  2.0,
    PARLIAMENT:  2.0,
    NGO_REPORT:  1.5,
    REGULATORY:  1.5,
    OTHER:       1.0,
  };

  const weightedMentions = policyMentions.reduce(
    (sum, m) => sum + (typeWeights[m.policyType] ?? 1.0),
    0
  );

  const score = Math.min(
    Math.round((weightedMentions / BASELINES.policyMentions) * 100),
    100
  );

  // Group by type for explanation
  const byType = policyMentions.reduce<Record<string, number>>((acc, m) => {
    acc[m.policyType] = (acc[m.policyType] ?? 0) + 1;
    return acc;
  }, {});

  return {
    score,
    weight: SCORE_WEIGHTS.policy,
    contribution: Math.round(score * SCORE_WEIGHTS.policy),
    explanation:
      policyMentions.length === 0
        ? "No policy mentions found yet. Submitting to policy consultations can dramatically increase your impact score."
        : `Your work has influenced ${policyMentions.length} policy document(s), demonstrating real-world impact.`,
    dataPoints: [
      `Total policy mentions: ${policyMentions.length}`,
      ...Object.entries(byType).map(([type, count]) => `${type}: ${count}`),
    ],
  };
}

function computeOpenAccessScore(
  publications: Array<{ openAccess: boolean }>
): ScoreComponentBreakdown {
  if (publications.length === 0) {
    return {
      score: 0,
      weight: SCORE_WEIGHTS.openAccess,
      contribution: 0,
      explanation: "No publications found yet.",
      dataPoints: [],
    };
  }

  const openCount = publications.filter((p) => p.openAccess).length;
  const rate = openCount / publications.length;
  const score = Math.round(rate * 100);

  return {
    score,
    weight: SCORE_WEIGHTS.openAccess,
    contribution: Math.round(score * SCORE_WEIGHTS.openAccess),
    explanation: `${openCount} of your ${publications.length} publication(s) are freely accessible, making your work available to more readers.`,
    dataPoints: [
      `Open access: ${openCount}/${publications.length} (${score}%)`,
      `Goal: 100% open access`,
    ],
  };
}

function computeCollaborationScore(
  publications: Array<{ coAuthors: unknown }>
): ScoreComponentBreakdown {
  // Count unique co-authors across all publications.
  // More unique collaborators = broader research network.
  const coAuthorSet = new Set<string>();

  for (const pub of publications) {
    // coAuthors is stored as JSON: [{ name, orcidId?, openAlexId? }]
    if (!Array.isArray(pub.coAuthors)) continue;
    for (const author of pub.coAuthors as Array<{ name?: string; orcidId?: string }>) {
      // Prefer ORCID id for deduplication; fall back to name
      const key = author.orcidId ?? author.name ?? "";
      if (key) coAuthorSet.add(key);
    }
  }

  const uniqueCoAuthors = coAuthorSet.size;
  const score = Math.min(
    Math.round((uniqueCoAuthors / BASELINES.uniqueCoAuthors) * 100),
    100
  );

  return {
    score,
    weight: SCORE_WEIGHTS.collaboration,
    contribution: Math.round(score * SCORE_WEIGHTS.collaboration),
    explanation: `You have collaborated with ${uniqueCoAuthors} unique co-author(s), ${uniqueCoAuthors >= BASELINES.uniqueCoAuthors ? "showing a strong research network" : "with room to grow your network"}.`,
    dataPoints: [
      `Unique co-authors: ${uniqueCoAuthors}`,
      `Baseline: ${BASELINES.uniqueCoAuthors}`,
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSIST SCORE
// Saves a computed score and updates cached aggregates on the researcher.
// ─────────────────────────────────────────────────────────────────────────────

export async function saveVisibilityScore(
  prisma: PrismaClient,
  researcherId: string
) {
  const scores = await computeVisibilityScore(prisma, researcherId);

  // Save a new score record (we keep history)
  const saved = await prisma.visibilityScore.create({
    data: {
      researcherId,
      ...scores,
      breakdown: scores.breakdown as object,
      algorithmVersion: SCORE_ALGORITHM_VERSION,
    },
  });

  return saved;
}
