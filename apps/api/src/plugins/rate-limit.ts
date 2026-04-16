// apps/api/src/plugins/rate-limit.ts
// API rate limiting — protects against abuse and runaway clients.
// In production, use Redis as the store for multi-instance deployments.

import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { FastifyPluginAsync } from "fastify";

const rateLimitPluginDef: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    // Global default: 100 requests per minute per IP
    max: 100,
    timeWindow: "1 minute",
    // In production, swap for Redis store:
    // redis: new Redis(process.env.REDIS_URL),
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests — please slow down and try again shortly.",
      },
    }),
  });
};

export const rateLimitPlugin = fp(rateLimitPluginDef, { name: "rate-limit" });
