// apps/api/src/routes/publications.ts
// Publication CRUD + list with pagination.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ForbiddenError, NotFoundError, ValidationError, formatError } from "../lib/errors.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@researchvy/shared";

const ListQuery = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sortBy:   z.enum(["year", "citationCount", "createdAt"]).default("year"),
  order:    z.enum(["asc", "desc"]).default("desc"),
  type:     z.string().optional(),
});

export const publicationRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /api/v1/publications — list the authenticated user's publications

  fastify.get("/", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const query = ListQuery.safeParse(req.query);
      if (!query.success) throw new ValidationError("Invalid query params", query.error.flatten());

      const { page, pageSize, sortBy, order, type } = query.data;

      const researcher = await fastify.prisma.researcher.findUnique({
        where: { userId: req.user.userId },
        select: { id: true },
      });
      if (!researcher) throw new NotFoundError("Researcher profile");

      const where = {
        researcherId: researcher.id,
        ...(type ? { type: type as never } : {}),
      };

      const [items, total] = await Promise.all([
        fastify.prisma.publication.findMany({
          where,
          orderBy: { [sortBy]: order },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            policyMentions: { select: { id: true, policyType: true, year: true } },
          },
        }),
        fastify.prisma.publication.count({ where }),
      ]);

      reply.send({
        success: true,
        data: {
          items,
          total,
          page,
          pageSize,
          hasMore: page * pageSize < total,
        },
      });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });

  // ── GET /api/v1/publications/:id ──────────────────────────────────────────

  fastify.get<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const pub = await fastify.prisma.publication.findUnique({
        where: { id: req.params.id },
        include: { policyMentions: true },
      });
      if (!pub) throw new NotFoundError("Publication");

      // Ensure this publication belongs to the requesting user
      const researcher = await fastify.prisma.researcher.findUnique({
        where: { userId: req.user.userId },
        select: { id: true },
      });
      if (!researcher || pub.researcherId !== researcher.id) {
        throw new ForbiddenError("You do not have access to this publication");
      }

      reply.send({ success: true, data: pub });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });
};
