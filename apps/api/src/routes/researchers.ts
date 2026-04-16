// apps/api/src/routes/researchers.ts
// Researcher profile CRUD.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ForbiddenError, NotFoundError, ValidationError, formatError } from "../lib/errors.js";

const UpdateProfileBody = z.object({
  displayName:   z.string().min(1).max(100).optional(),
  institution:   z.string().max(200).optional(),
  department:    z.string().max(200).optional(),
  country:       z.string().length(2).optional(), // ISO 3166-1 alpha-2
  fields:        z.array(z.string().max(50)).max(10).optional(),
  bio:           z.string().max(1000).optional(),
  websiteUrl:    z.string().url().optional().or(z.literal("")),
  twitterHandle: z.string().max(50).optional(),
});

export const researcherRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /api/v1/researchers/me ────────────────────────────────────────────

  fastify.get("/me", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const researcher = await fastify.prisma.researcher.findUnique({
        where: { userId: req.user.userId },
      });
      if (!researcher) throw new NotFoundError("Researcher profile");

      reply.send({ success: true, data: researcher });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });

  // ── PATCH /api/v1/researchers/me ──────────────────────────────────────────

  fastify.patch("/me", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const body = UpdateProfileBody.safeParse(req.body);
      if (!body.success) throw new ValidationError("Invalid profile data", body.error.flatten());

      const researcher = await fastify.prisma.researcher.findUnique({
        where: { userId: req.user.userId },
        select: { id: true },
      });
      if (!researcher) throw new NotFoundError("Researcher profile");

      const updated = await fastify.prisma.researcher.update({
        where: { id: researcher.id },
        data: body.data,
      });

      reply.send({ success: true, data: updated });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });

  // ── GET /api/v1/researchers/:id ───────────────────────────────────────────
  // Public profile — no auth required (researchers may want a public page)

  fastify.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    try {
      const researcher = await fastify.prisma.researcher.findUnique({
        where: { id: req.params.id },
        // Only expose safe public fields
        select: {
          id: true,
          displayName: true,
          institution: true,
          department: true,
          country: true,
          fields: true,
          bio: true,
          websiteUrl: true,
          twitterHandle: true,
          hIndex: true,
          totalCitations: true,
          publicationCount: true,
          orcidId: true,
          // Never expose tokens or internal IDs
        },
      });
      if (!researcher) throw new NotFoundError("Researcher");
      reply.send({ success: true, data: researcher });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });
};
