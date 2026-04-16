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
          ...researcher,
          createdAt: researcher.createdAt.toISOString(),
          updatedAt: undefined as never, // not in DashboardData type
          lastSyncedAt: researcher.lastSyncedAt?.toISOString(),
          orcidTokenExpiry: undefined as never,
          orcidAccessToken: undefined as never, // NEVER expose tokens to frontend
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
          ...p,
          researcherId: researcher.id,
          source: "OPEN_ALEX" as const,
          coAuthors: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        pendingRecommendations: pendingRecommendations.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
        activeSync: activeSync
          ? {
              ...activeSync,
              startedAt: activeSync.startedAt?.toISOString(),
              completedAt: activeSync.completedAt?.toISOString(),
              createdAt: activeSync.createdAt.toISOString(),
            }
          : null,
      };

      reply.send({ success: true, data });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });
};
