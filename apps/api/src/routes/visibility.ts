// apps/api/src/routes/visibility.ts
// Visibility score endpoints — fetch history and trigger recompute.

import type { FastifyPluginAsync } from "fastify";
import { NotFoundError, formatError } from "../lib/errors.js";
import { saveVisibilityScore } from "../services/visibility-score.js";

export const visibilityRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /api/v1/visibility/latest ────────────────────────────────────────
  // Returns the most recently computed score + full breakdown.

  fastify.get("/latest", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const researcher = await fastify.prisma.researcher.findUnique({
        where: { userId: req.user.userId },
        select: { id: true },
      });
      if (!researcher) throw new NotFoundError("Researcher profile");

      const score = await fastify.prisma.visibilityScore.findFirst({
        where: { researcherId: researcher.id },
        orderBy: { computedAt: "desc" },
      });

      // A null score means the researcher hasn't been synced yet — that's OK
      reply.send({ success: true, data: score });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });

  // ── GET /api/v1/visibility/history ───────────────────────────────────────
  // Returns score history for charting. Last 30 data points.

  fastify.get("/history", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const researcher = await fastify.prisma.researcher.findUnique({
        where: { userId: req.user.userId },
        select: { id: true },
      });
      if (!researcher) throw new NotFoundError("Researcher profile");

      const history = await fastify.prisma.visibilityScore.findMany({
        where: { researcherId: researcher.id },
        orderBy: { computedAt: "asc" },
        take: 30,
        select: {
          id: true,
          overallScore: true,
          citationScore: true,
          velocityScore: true,
          policyScore: true,
          openAccessScore: true,
          collaborationScore: true,
          computedAt: true,
          algorithmVersion: true,
        },
      });

      reply.send({ success: true, data: history });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });

  // ── POST /api/v1/visibility/compute ──────────────────────────────────────
  // Trigger an on-demand score recompute from existing data.
  // This is fast (< 100ms) since it uses already-fetched publications.

  fastify.post("/compute", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const researcher = await fastify.prisma.researcher.findUnique({
        where: { userId: req.user.userId },
        select: { id: true },
      });
      if (!researcher) throw new NotFoundError("Researcher profile");

      const score = await saveVisibilityScore(fastify.prisma, researcher.id);

      reply.send({ success: true, data: score });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });
};
