// apps/api/src/routes/recommendations.ts
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { NotFoundError, ForbiddenError, formatError } from "../lib/errors.js";

const patchSchema = z.object({
  isActioned:  z.boolean().optional(),
  isDismissed: z.boolean().optional(),
}).refine((d) => d.isActioned !== undefined || d.isDismissed !== undefined, {
  message: "At least one of isActioned or isDismissed must be provided",
});

export const recommendationRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /api/v1/recommendations ───────────────────────────────────────────

  fastify.get("/", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const researcher = await fastify.prisma.researcher.findUnique({
        where: { userId: req.user.userId },
        select: { id: true },
      });
      if (!researcher) throw new NotFoundError("Researcher profile");

      const recommendations = await fastify.prisma.recommendation.findMany({
        where: { researcherId: researcher.id },
        orderBy: [{ impact: "desc" }, { createdAt: "desc" }],
      });

      reply.send({
        success: true,
        data: recommendations.map((r) => ({
          ...r,
          resourceUrl: r.resourceUrl ?? undefined,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });

  // ── PATCH /api/v1/recommendations/:id ─────────────────────────────────────

  fastify.patch("/:id", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };

      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        });
      }

      // Verify ownership before updating
      const existing = await fastify.prisma.recommendation.findUnique({
        where: { id },
        select: { researcherId: true },
      });
      if (!existing) throw new NotFoundError("Recommendation");

      const researcher = await fastify.prisma.researcher.findUnique({
        where: { userId: req.user.userId },
        select: { id: true },
      });
      if (!researcher || existing.researcherId !== researcher.id) {
        throw new ForbiddenError();
      }

      const updated = await fastify.prisma.recommendation.update({
        where: { id },
        data: parsed.data,
      });

      reply.send({
        success: true,
        data: {
          ...updated,
          resourceUrl: updated.resourceUrl ?? undefined,
          createdAt: updated.createdAt.toISOString(),
        },
      });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });
};
