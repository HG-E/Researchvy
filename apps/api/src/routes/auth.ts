// apps/api/src/routes/auth.ts
// Authentication routes: register, login, ORCID OAuth, logout.
//
// Auth strategy:
//   - Email/password for initial signup
//   - ORCID OAuth2 for connecting researcher identity
//   - JWT Bearer tokens (stateless) for API access
//   - Sessions table tracks active tokens for revocation capability

import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError, formatError } from "../lib/errors.js";
import { getOrcidAuthUrl, exchangeOrcidCode, fetchOrcidProfile } from "../services/orcid.js";
import { encrypt } from "../lib/crypto.js";
import crypto from "crypto";

// ── Validation schemas ───────────────────────────────────────────────────────

const RegisterBody = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(100),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /api/v1/auth/register ─────────────────────────────────────────────

  fastify.post("/register", async (req, reply) => {
    try {
      const body = RegisterBody.safeParse(req.body);
      if (!body.success) {
        throw new ValidationError("Invalid registration data", body.error.flatten());
      }

      const { email, password, name } = body.data;

      // Check for existing account
      const existing = await fastify.prisma.user.findUnique({ where: { email } });
      if (existing) throw new ConflictError("An account with this email already exists");

      // Hash password — bcrypt with cost factor 12 (good balance of speed vs security)
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user + researcher profile in a transaction
      const result = await fastify.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, name, passwordHash, emailVerified: false },
        });

        const researcher = await tx.researcher.create({
          data: {
            userId: user.id,
            displayName: name,
          },
        });

        return { user, researcher };
      });

      const token = fastify.jwt.sign({
        userId: result.user.id,
        role: result.user.role,
      });

      reply.code(201).send({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
          },
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
    } catch (err) {
      const formatted = formatError(err);
      reply.code(err instanceof Error && "statusCode" in err ? (err as { statusCode: number }).statusCode : 500)
           .send(formatted);
    }
  });

  // ── POST /api/v1/auth/login ───────────────────────────────────────────────

  fastify.post("/login", async (req, reply) => {
    try {
      const body = LoginBody.safeParse(req.body);
      if (!body.success) throw new ValidationError("Invalid credentials");

      const { email, password } = body.data;

      const user = await fastify.prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) {
        // Constant-time comparison to prevent timing attacks
        await bcrypt.compare(password, "$2b$12$invalidhashfortimingprotection");
        throw new UnauthorizedError("Invalid email or password");
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw new UnauthorizedError("Invalid email or password");

      const token = fastify.jwt.sign({ userId: user.id, role: user.role });

      reply.send({
        success: true,
        data: {
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
    } catch (err) {
      const formatted = formatError(err);
      reply.code(err instanceof Error && "statusCode" in err ? (err as { statusCode: number }).statusCode : 500)
           .send(formatted);
    }
  });

  // ── GET /api/v1/auth/me ───────────────────────────────────────────────────

  fastify.get("/me", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    try {
      const user = await fastify.prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { researcher: true },
      });
      if (!user) throw new NotFoundError("User");

      reply.send({ success: true, data: { user, researcher: user.researcher } });
    } catch (err) {
      const formatted = formatError(err);
      reply.code(err instanceof Error && "statusCode" in err ? (err as { statusCode: number }).statusCode : 500)
           .send(formatted);
    }
  });

  // ── GET /api/v1/auth/orcid ────────────────────────────────────────────────
  // Step 1 of ORCID OAuth: redirect user to ORCID consent page

  fastify.get("/orcid", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    // state = signed JWT containing userId — verified on callback to prevent CSRF
    const state = fastify.jwt.sign({ userId: req.user.userId }, { expiresIn: "10m" });
    const url = getOrcidAuthUrl(state);
    reply.redirect(url);
  });

  // ── GET /api/v1/auth/orcid/callback ──────────────────────────────────────
  // Step 2: ORCID redirects back here with code + state

  fastify.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/orcid/callback",
    async (req, reply) => {
      const webUrl = process.env["NEXTAUTH_URL"] ?? "http://localhost:3000";

      try {
        const { code, state, error } = req.query;

        if (error || !code || !state) {
          return reply.redirect(`${webUrl}/dashboard?orcid_error=access_denied`);
        }

        // Verify state to prevent CSRF
        let statePayload: { userId: string };
        try {
          statePayload = fastify.jwt.verify<{ userId: string }>(state);
        } catch {
          return reply.redirect(`${webUrl}/dashboard?orcid_error=invalid_state`);
        }

        // Exchange code for ORCID access token
        const tokenData = await exchangeOrcidCode(code);

        // Fetch public profile
        const profile = await fetchOrcidProfile(tokenData.orcid);

        // Store encrypted access token + update researcher profile
        await fastify.prisma.researcher.update({
          where: { userId: statePayload.userId },
          data: {
            orcidId: tokenData.orcid,
            orcidAccessToken: encrypt(tokenData.access_token),
            orcidTokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
            displayName: profile.name,
            institution: profile.institution ?? undefined,
            country: profile.country ?? undefined,
            fields: profile.keywords,
            bio: profile.biography ?? undefined,
          },
        });

        // Kick off a background sync job (processed by Python worker)
        await fastify.prisma.syncJob.create({
          data: {
            researcherId: (await fastify.prisma.researcher.findUniqueOrThrow({
              where: { userId: statePayload.userId },
              select: { id: true },
            })).id,
            source: "ORCID",
            trigger: "orcid_connect",
          },
        });

        reply.redirect(`${webUrl}/dashboard?orcid_connected=true`);
      } catch (err) {
        fastify.log.error(err, "ORCID callback error");
        reply.redirect(`${webUrl}/dashboard?orcid_error=server_error`);
      }
    }
  );

  // ── POST /api/v1/auth/logout ──────────────────────────────────────────────

  fastify.post("/logout", {
    preHandler: [fastify.authenticate],
  }, async (_req, reply) => {
    // JWT is stateless — "logout" is handled client-side by deleting the token.
    // If you need server-side revocation, add the token hash to a blocklist in Redis.
    reply.send({ success: true, data: { message: "Logged out successfully" } });
  });
};
