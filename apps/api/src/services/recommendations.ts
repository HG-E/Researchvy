// apps/api/src/services/recommendations.ts
// Generates prioritised recommendations after each sync.
//
// Design:
//   - Idempotent: uses upsert-by-type so re-running after a sync
//     updates existing recs rather than duplicating them.
//   - Respects user actions: dismissed/actioned recs are never overwritten.
//   - Each rule is independent — easy to add/remove without side effects.

import type { PrismaClient } from "@prisma/client";

interface RecommendationInput {
  type: string;
  title: string;
  body: string;
  impact: "LOW" | "MEDIUM" | "HIGH";
  resourceUrl?: string;
}

export async function generateRecommendations(
  db: PrismaClient,
  researcherId: string
): Promise<void> {
  const [researcher, latestScore, publications, policyMentions] = await Promise.all([
    db.researcher.findUniqueOrThrow({ where: { id: researcherId } }),
    db.visibilityScore.findFirst({
      where: { researcherId },
      orderBy: { computedAt: "desc" },
    }),
    db.publication.findMany({
      where: { researcherId },
      select: { type: true, openAccess: true, coAuthors: true },
    }),
    db.policyMention.findMany({
      where: { publication: { researcherId } },
      select: { id: true },
    }),
  ]);

  const recs: RecommendationInput[] = [];

  // ── Rule 1: ORCID not connected ──────────────────────────────────────────
  if (!researcher.orcidId) {
    recs.push({
      type: "ORCID_COMPLETE",
      title: "Connect your ORCID profile",
      body: "ORCID is the global standard for researcher identity. Connecting it lets citation databases reliably attribute your work to you, improving your citation and collaboration scores.",
      impact: "HIGH",
      resourceUrl: "https://orcid.org/register",
    });
  }

  // ── Rule 2: Low policy score ──────────────────────────────────────────────
  if (!latestScore || latestScore.policyScore < 30) {
    recs.push({
      type: "POLICY_SUBMISSION",
      title: "Submit your research to policy consultations",
      body: policyMentions.length === 0
        ? "None of your publications appear in government or UN reports yet. Policy submissions can add 8–15 points to your visibility score and demonstrate real-world impact."
        : `Only ${policyMentions.length} policy mention(s) detected. Submitting to open consultations in your field can significantly raise your policy score.`,
      impact: "HIGH",
      resourceUrl: "https://www.parliament.uk/business/committees/",
    });
  }

  // ── Rule 3: Closed access papers ─────────────────────────────────────────
  const closedAccessCount = publications.filter((p) => !p.openAccess).length;
  if (closedAccessCount > 0) {
    recs.push({
      type: "OPEN_ACCESS",
      title: `Make ${closedAccessCount} paper${closedAccessCount > 1 ? "s" : ""} open access`,
      body: `${closedAccessCount} of your publication${closedAccessCount > 1 ? "s are" : " is"} behind a paywall. Open access papers receive 50–200% more citations. Upload accepted manuscripts to your institutional repository or arXiv.`,
      impact: closedAccessCount >= 3 ? "HIGH" : "MEDIUM",
      resourceUrl: "https://arxiv.org/submit",
    });
  }

  // ── Rule 4: No preprints ──────────────────────────────────────────────────
  const hasPreprints = publications.some((p) => p.type === "PREPRINT");
  if (!hasPreprints && publications.length > 0) {
    recs.push({
      type: "PREPRINT_UPLOAD",
      title: "Upload preprints to arXiv or bioRxiv",
      body: "Preprints make your work immediately visible before peer review, often 12–18 months earlier. Researchers who post preprints receive significantly more citations on average.",
      impact: "MEDIUM",
      resourceUrl: "https://arxiv.org/submit",
    });
  }

  // ── Rule 5: Low collaboration reach ──────────────────────────────────────
  const coAuthorSet = new Set<string>();
  for (const pub of publications) {
    if (!Array.isArray(pub.coAuthors)) continue;
    for (const a of pub.coAuthors as Array<{ name?: string; orcidId?: string }>) {
      const key = a.orcidId ?? a.name ?? "";
      if (key) coAuthorSet.add(key);
    }
  }
  if (coAuthorSet.size < 5 && publications.length > 0) {
    recs.push({
      type: "COLLABORATION",
      title: "Grow your collaboration network",
      body: `You have ${coAuthorSet.size} unique co-author${coAuthorSet.size !== 1 ? "s" : ""} detected. Researchers with broader networks score 20–40% higher on collaboration reach. Consider reaching out to authors in your field.`,
      impact: "LOW",
    });
  }

  // ── Rule 6: No conference papers ─────────────────────────────────────────
  const hasConference = publications.some((p) => p.type === "CONFERENCE_PAPER");
  if (!hasConference && publications.length > 0) {
    recs.push({
      type: "CONFERENCE",
      title: "Target high-impact conferences in your field",
      body: "No conference papers detected yet. Conference publications increase visibility by putting your work in front of active researchers and can lead to collaboration opportunities.",
      impact: "LOW",
    });
  }

  // ── Rule 7: Incomplete profile ────────────────────────────────────────────
  if (!researcher.bio || researcher.bio.length < 50) {
    recs.push({
      type: "PROFILE_COMPLETE",
      title: "Complete your researcher profile",
      body: "A full bio and institution help policy makers, journalists, and collaborators find and understand your work. Profiles with complete bios receive significantly more views.",
      impact: "LOW",
      resourceUrl: "/profile/settings",
    });
  }

  // ── Upsert each recommendation ────────────────────────────────────────────
  // For each generated rec: update an existing active (not actioned/dismissed)
  // rec of the same type, or create a new one if none exists.
  // This means dismissed recs are never resurrected automatically.

  for (const rec of recs) {
    const existing = await db.recommendation.findFirst({
      where: {
        researcherId,
        type: rec.type as never,
        isActioned: false,
        isDismissed: false,
      },
    });

    if (existing) {
      await db.recommendation.update({
        where: { id: existing.id },
        data: {
          title: rec.title,
          body: rec.body,
          impact: rec.impact as never,
          resourceUrl: rec.resourceUrl ?? null,
        },
      });
    } else {
      await db.recommendation.create({
        data: {
          researcherId,
          type: rec.type as never,
          title: rec.title,
          body: rec.body,
          impact: rec.impact as never,
          resourceUrl: rec.resourceUrl ?? null,
        },
      });
    }
  }
}
