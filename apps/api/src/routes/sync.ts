// apps/api/src/routes/sync.ts
// Data sync endpoints — trigger and monitor background data fetches.
//
// Architecture:
//   The API creates a SyncJob record with status=PENDING.
//   The Python worker polls for PENDING jobs, processes them, and updates status.
//   The frontend polls GET /sync/status to show progress.

import type { FastifyPluginAsync } from "fastify";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { NotFoundError, ValidationError, formatError } from "../lib/errors.js";
import { fetchAuthorWorks, fetchPolicyMentions } from "../services/openalex.js";
import { saveVisibilityScore } from "../services/visibility-score.js";
import { generateRecommendations } from "../services/recommendations.js";
import type { DataSource } from "@prisma/client";
import { MIN_SYNC_INTERVAL_MINUTES } from "@researchvy/shared";

const TriggerSyncBody = z.object({
  source: z.enum(["ORCID", "OPEN_ALEX", "SEMANTIC_SCHOLAR"]),
});

export const syncRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /api/v1/sync/trigger ─────────────────────────────────────────────
  // Creates a sync job. The Python worker picks it up asynchronously.
  // For OpenAlex, we also run the sync inline if it's fast enough.

  fastify.post("/trigger", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const body = TriggerSyncBody.safeParse(req.body);
      if (!body.success) throw new ValidationError("Invalid sync request", body.error.flatten());

      const researcher = await fastify.prisma.researcher.findUnique({
        where: { userId: req.user.userId },
      });
      if (!researcher) throw new NotFoundError("Researcher profile");

      // Throttle: prevent hammering external APIs
      const recentJob = await fastify.prisma.syncJob.findFirst({
        where: {
          researcherId: researcher.id,
          source: body.data.source,
          createdAt: { gte: new Date(Date.now() - MIN_SYNC_INTERVAL_MINUTES * 60 * 1000) },
          status: { in: ["PENDING", "RUNNING", "COMPLETED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (recentJob?.status === "RUNNING") {
        return reply.send({
          success: true,
          data: { job: recentJob, message: "Sync already in progress" },
        });
      }

      if (recentJob?.status === "COMPLETED") {
        return reply.code(429).send({
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `Please wait ${MIN_SYNC_INTERVAL_MINUTES} minutes between syncs`,
          },
        });
      }

      const job = await fastify.prisma.syncJob.create({
        data: {
          researcherId: researcher.id,
          source: body.data.source as DataSource,
          trigger: "manual",
        },
      });

      // For OpenAlex, run inline in the API process (fast, no worker needed)
      // ORCID sync is handled by the Python worker (more complex parsing)
      if (body.data.source === "OPEN_ALEX" && researcher.openAlexId) {
        // Run async — don't make the user wait
        runOpenAlexSync(fastify.prisma, researcher.id, researcher.openAlexId, job.id)
          .catch((err) => fastify.log.error(err, "OpenAlex sync failed"));
      }

      reply.code(202).send({
        success: true,
        data: { job, message: "Sync job queued" },
      });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });

  // ── GET /api/v1/sync/status ───────────────────────────────────────────────
  // Returns the status of recent sync jobs (used by frontend for progress UI).

  fastify.get("/status", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const researcher = await fastify.prisma.researcher.findUnique({
        where: { userId: req.user.userId },
        select: { id: true },
      });
      if (!researcher) throw new NotFoundError("Researcher profile");

      const jobs = await fastify.prisma.syncJob.findMany({
        where: { researcherId: researcher.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      reply.send({ success: true, data: jobs });
    } catch (err) {
      reply.code((err as { statusCode?: number }).statusCode ?? 500).send(formatError(err));
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// INLINE OPENALEX SYNC
// Runs in the API process for fast turnaround.
// For large profiles (100+ papers), the Python worker handles it instead.
// ─────────────────────────────────────────────────────────────────────────────

async function runOpenAlexSync(
  db: PrismaClient,
  researcherId: string,
  openAlexId: string,
  jobId: string
) {

  await db.syncJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    // 1. Fetch all works from OpenAlex
    const works = await fetchAuthorWorks(openAlexId);

    await db.syncJob.update({
      where: { id: jobId },
      data: { itemsFound: works.length },
    });

    // 2. Upsert each publication
    let processed = 0;
    for (const work of works) {
      await db.publication.upsert({
        where: { openAlexId: work.openAlexId },
        update: {
          citationCount: work.citationCount,
          openAccess: work.openAccess,
          openAccessUrl: work.openAccessUrl ?? null,
          abstract: work.abstract ?? null,
        },
        create: {
          researcherId,
          openAlexId: work.openAlexId,
          doi: work.doi ?? null,
          title: work.title,
          abstract: work.abstract ?? null,
          year: work.year ?? null,
          type: work.type as never,
          citationCount: work.citationCount,
          openAccess: work.openAccess,
          openAccessUrl: work.openAccessUrl ?? null,
          journalName: work.journalName ?? null,
          coAuthors: work.coAuthors as never,
          source: "OPEN_ALEX",
          rawData: work as never,
        },
      });

      // 3. For each publication, check for policy mentions
      // Only do this for papers with significant citations (optimization)
      if (work.citationCount > 5) {
        const policyMentions = await fetchPolicyMentions(work.openAlexId);
        for (const mention of policyMentions) {
          const pub = await db.publication.findUnique({
            where: { openAlexId: work.openAlexId },
            select: { id: true },
          });
          if (!pub) continue;

          await db.policyMention.create({
            data: {
              publicationId: pub.id,
              policyTitle: mention.policyTitle,
              policyUrl: mention.policyUrl ?? null,
              policyType: mention.policyType as never,
              country: mention.country ?? null,
              year: mention.year ?? null,
              organization: mention.organization ?? null,
              source: "open_alex",
            },
          }).catch(() => {
            // Ignore duplicates — policy mentions may be re-fetched
          });
        }
      }

      processed++;
    }

    // 4. Update researcher cached stats
    const [totalCitations, pubCount] = await Promise.all([
      db.publication.aggregate({
        where: { researcherId },
        _sum: { citationCount: true },
      }),
      db.publication.count({ where: { researcherId } }),
    ]);

    // Compute h-index from citation counts
    const allCitations = await db.publication.findMany({
      where: { researcherId },
      select: { citationCount: true },
      orderBy: { citationCount: "desc" },
    });
    const hIndex = computeHIndex(allCitations.map((p) => p.citationCount));

    await db.researcher.update({
      where: { id: researcherId },
      data: {
        hIndex,
        totalCitations: totalCitations._sum.citationCount ?? 0,
        publicationCount: pubCount,
        lastSyncedAt: new Date(),
      },
    });

    // 5. Recompute visibility score with fresh data
    await saveVisibilityScore(db, researcherId);

    // 6. Generate/update recommendations based on new score + publications
    await generateRecommendations(db, researcherId);

    // 7. Mark job complete
    await db.syncJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        itemsProcessed: processed,
      },
    });
  } catch (err) {
    await db.syncJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: err instanceof Error ? err.message : "Unknown error",
      },
    });
    throw err;
  }
}

/** Computes h-index from an array of citation counts (descending order). */
function computeHIndex(sortedCitations: number[]): number {
  let h = 0;
  for (let i = 0; i < sortedCitations.length; i++) {
    const citations = sortedCitations[i];
    if (citations !== undefined && citations >= i + 1) {
      h = i + 1;
    } else {
      break;
    }
  }
  return h;
}
