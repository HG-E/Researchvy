// apps/api/src/routes/researchers.ts
// Researcher profile CRUD.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { NotFoundError, ValidationError, formatError } from "../lib/errors.js";

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

  // ── GET /api/v1/researchers/search ───────────────────────────────────────
  // Public, no auth. Proxies OpenAlex to avoid CORS and normalise shapes.
  // ?mode=name&q=Jane+Smith  OR  ?mode=orcid&q=0000-0002-1825-0097

  fastify.get<{ Querystring: { mode?: string; q?: string } }>(
    "/search",
    async (req, reply) => {
      try {
        const { mode, q } = req.query;
        if (!q || q.trim().length < 2) {
          return reply.code(400).send({ success: false, error: { code: "BAD_REQUEST", message: "q is required" } });
        }

        const email = process.env["OPENALEX_EMAIL"] ?? "hello@researchvy.com";
        let url: string;

        if (mode === "orcid") {
          url = `https://api.openalex.org/authors?filter=orcid:${encodeURIComponent(q.trim())}&per_page=5&mailto=${email}`;
        } else {
          url = `https://api.openalex.org/authors?search=${encodeURIComponent(q.trim())}&per_page=6&mailto=${email}`;
        }

        const res = await fetch(url, { headers: { "User-Agent": `Researchvy/1.0 (${email})` } });
        if (!res.ok) throw new Error(`OpenAlex returned ${res.status}`);

        const json = await res.json() as {
          results: Array<{
            id: string;
            display_name: string;
            last_known_institutions?: Array<{ display_name: string; country_code: string }>;
            topics?: Array<{ display_name: string }>;
            summary_stats?: { h_index: number; i10_index: number; cited_by_count: number };
            works_count: number;
            cited_by_count: number;
            ids?: { orcid?: string };
          }>;
        };

        const candidates = (json.results ?? []).map((a) => ({
          id: a.id.replace("https://openalex.org/", ""),
          displayName: a.display_name,
          institution: a.last_known_institutions?.[0]?.display_name,
          country: a.last_known_institutions?.[0]?.country_code,
          fields: (a.topics ?? []).slice(0, 5).map((t) => t.display_name),
          hIndex: a.summary_stats?.h_index ?? 0,
          citationCount: a.cited_by_count ?? 0,
          publicationCount: a.works_count ?? 0,
          orcidId: a.ids?.orcid?.replace("https://orcid.org/", ""),
          openAlexUrl: a.id,
        }));

        reply.send({ success: true, data: candidates });
      } catch (err) {
        fastify.log.error(err, "OpenAlex search error");
        reply.code(502).send(formatError(err));
      }
    }
  );

  // ── GET /api/v1/researchers/public/:openAlexId ────────────────────────────
  // Public profile with a computed score estimate — used on /check/results.
  // No auth required; score is estimated from OpenAlex stats (not our DB).

  fastify.get<{ Params: { openAlexId: string } }>(
    "/public/:openAlexId",
    async (req, reply) => {
      try {
        const { openAlexId } = req.params;
        const email = process.env["OPENALEX_EMAIL"] ?? "hello@researchvy.com";
        const url = `https://api.openalex.org/authors/${openAlexId}?mailto=${email}`;

        const res = await fetch(url, { headers: { "User-Agent": `Researchvy/1.0 (${email})` } });
        if (!res.ok) {
          return reply.code(404).send({ success: false, error: { code: "NOT_FOUND", message: "Profile not found" } });
        }

        const a = await res.json() as {
          id: string;
          display_name: string;
          last_known_institutions?: Array<{ display_name: string; country_code: string }>;
          topics?: Array<{ display_name: string }>;
          summary_stats?: { h_index: number; i10_index: number; cited_by_count: number };
          works_count: number;
          cited_by_count: number;
          ids?: { orcid?: string };
          x_concepts?: Array<{ display_name: string; score: number }>;
        };

        const h = a.summary_stats?.h_index ?? 0;
        const citations = a.cited_by_count ?? 0;
        const works = a.works_count ?? 0;

        // Simple score estimate — the real score is computed by the Python worker
        // after a full sync. This is a lightweight preview.
        const citationScore = Math.min(100, Math.round((h * 3) + (citations / 100)));
        const velocityScore = Math.min(100, Math.round(works * 2.5));
        const policyScore = 20; // Unknown without Overton data
        const openAccessScore = 50; // Unknown without works metadata
        const collaborationScore = Math.min(100, Math.round(h * 2));
        const overallScore = Math.round(
          citationScore * 0.30 +
          velocityScore * 0.20 +
          policyScore  * 0.25 +
          openAccessScore * 0.10 +
          collaborationScore * 0.15
        );

        // Rough percentile estimate based on h-index distribution
        const percentile = Math.min(99, Math.round(
          h > 50 ? 95 :
          h > 30 ? 85 :
          h > 20 ? 75 :
          h > 10 ? 60 :
          h > 5  ? 45 : 30
        ));

        const gaps: string[] = [];
        if (!a.ids?.orcid) gaps.push("No ORCID iD linked — citation databases can't reliably attribute your work");
        if (openAccessScore < 50) gaps.push("Many papers may be behind paywalls — open access papers get 50–200% more citations");
        if (policyScore < 30) gaps.push("No policy citations detected — consider submitting to government consultations");

        const profile = {
          id: a.id.replace("https://openalex.org/", ""),
          displayName: a.display_name,
          institution: a.last_known_institutions?.[0]?.display_name,
          country: a.last_known_institutions?.[0]?.country_code,
          fields: (a.topics ?? []).slice(0, 5).map((t) => t.display_name),
          hIndex: h,
          citationCount: citations,
          publicationCount: works,
          orcidId: a.ids?.orcid?.replace("https://orcid.org/", ""),
          overallScore,
          percentile,
          scoreBand:
            overallScore >= 80 ? "Elite" :
            overallScore >= 65 ? "Prominent" :
            overallScore >= 45 ? "Established" :
            overallScore >= 25 ? "Emerging" : "Early Career",
          scoreBreakdown: [
            { label: "Citation Impact",     score: citationScore,      color: "#6366f1", weight: 30 },
            { label: "Policy Influence",    score: policyScore,        color: "#10b981", weight: 25 },
            { label: "Citation Velocity",   score: velocityScore,      color: "#3b82f6", weight: 20 },
            { label: "Collaboration Reach", score: collaborationScore, color: "#8b5cf6", weight: 15 },
            { label: "Open Access Rate",    score: openAccessScore,    color: "#f59e0b", weight: 10 },
          ],
          gaps,
        };

        reply.send({ success: true, data: profile });
      } catch (err) {
        fastify.log.error(err, "Public profile error");
        reply.code(502).send(formatError(err));
      }
    }
  );

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
