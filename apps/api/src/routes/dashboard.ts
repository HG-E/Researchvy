// apps/api/src/routes/dashboard.ts
// Single endpoint that returns everything the dashboard needs in one request.
// This avoids N round-trips on first load — critical for perceived performance.

import type { FastifyPluginAsync } from "fastify";
import { NotFoundError, formatError } from "../lib/errors.js";
import type { DashboardData } from "@researchvy/shared";

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /api/v1/dashboard ─────────────────────────────────────────────────

  fastify.get("/", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const researcher = await fastify.prisma.researcher.findUnique({
        where: { userId: req.user.userId },
      });
      if (!researcher) throw new NotFoundError("Researcher profile");

      // Load all dashboard data in parallel — 5 queries, one round-trip
      const [latestScore, scoreHistory, recentPublications, pendingRecommendations, activeSync] =
        await Promise.all([
          // Most recent visibility score with full breakdown
          fastify.prisma.visibilityScore.findFirst({
            where: { researcherId: researcher.id },
            orderBy: { computedAt: "desc" },
          }),

          // Last 12 scores for the sparkline chart
          fastify.prisma.visibilityScore.findMany({
            where: { researcherId: researcher.id },
            orderBy: { computedAt: "asc" },
            take: 12,
            select: { computedAt: true, overallScore: true },
          }),

          // 5 most-cited publications for the dashboard card
          fastify.prisma.publication.findMany({
            where: { researcherId: researcher.id },
            orderBy: { citationCount: "desc" },
            take: 5,
            select: {
              id: true,
              title: true,
              year: true,
              citationCount: true,
              type: true,
              openAccess: true,
              journalName: true,
              venueName: true,
              doi: true,
            },
          }),

          // Pending (not actioned, not dismissed) recommendations
          fastify.prisma.recommendation.findMany({
            where: {
              researcherId: researcher.id,
              isActioned: false,
              isDismissed: false,
            },
            orderBy: [
              { impact: "desc" },
              { createdAt: "desc" },
            ],
            take: 5,
          }),

          // Any currently running sync job
          fastify.prisma.syncJob.findFirst({
            where: {
              researcherId: researcher.id,
              status: { in: ["PENDING", "RUNNING"] },
            },
            orderBy: { createdAt: "desc" },
          }),
        ]);

      const data: DashboardData = {
        researcher: {
          id: researcher.id,
          userId: researcher.userId,
          orcidId: researcher.orcidId ?? undefined,
          openAlexId: researcher.openAlexId ?? undefined,
          displayName: researcher.displayName,
          institution: researcher.institution ?? undefined,
          department: researcher.department ?? undefined,
          country: researcher.country ?? undefined,
          fields: researcher.fields,
          bio: researcher.bio ?? undefined,
          websiteUrl: researcher.websiteUrl ?? undefined,
          twitterHandle: researcher.twitterHandle ?? undefined,
          hIndex: researcher.hIndex,
          totalCitations: researcher.totalCitations,
          publicationCount: researcher.publicationCount,
          lastSyncedAt: researcher.lastSyncedAt?.toISOString(),
          createdAt: researcher.createdAt.toISOString(),
          // orcidAccessToken deliberately excluded — never expose tokens to frontend
        },
        latestScore: latestScore
          ? {
              ...latestScore,
              breakdown: latestScore.breakdown as never,
              computedAt: latestScore.computedAt.toISOString(),
            }
          : null,
        scoreHistory: scoreHistory.map((s) => ({
          computedAt: s.computedAt.toISOString(),
          overallScore: s.overallScore,
        })),
        recentPublications: recentPublications.map((p) => ({
          id: p.id,
          researcherId: researcher.id,
          title: p.title,
          type: p.type,
          citationCount: p.citationCount,
          openAccess: p.openAccess,
          source: "OPEN_ALEX" as const,
          coAuthors: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          doi:         p.doi         ?? undefined,
          year:        p.year        ?? undefined,
          journalName: p.journalName ?? undefined,
          venueName:   p.venueName   ?? undefined,
        })),
        pendingRecommendations: pendingRecommendations.map((r) => ({
          id: r.id,
          researcherId: r.researcherId,
          type: r.type,
          title: r.title,
          body: r.body,
          impact: r.impact,
          isActioned: r.isActioned,
          isDismissed: r.isDismissed,
          createdAt: r.createdAt.toISOString(),
          resourceUrl: r.resourceUrl ?? undefined,
        })),
        activeSync: activeSync
          ? {
              id: activeSync.id,
              researcherId: activeSync.researcherId,
              source: activeSync.source,
              status: activeSync.status,
              trigger: activeSync.trigger,
              itemsFound: activeSync.itemsFound,
              itemsProcessed: activeSync.itemsProcessed,
              createdAt: activeSync.createdAt.toISOString(),
              startedAt:   activeSync.startedAt?.toISOString(),
              completedAt: activeSync.completedAt?.toISOString(),
              error:       activeSync.error ?? undefined,
            }
          : null,
      };

      reply.send({ success: true, data });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });
};
