// apps/api/src/plugins/jwt.ts
// JWT authentication plugin.
//
// Strategy:
//   - Short-lived access tokens (7d default) sent as Bearer tokens
//   - Tokens contain { userId, role } — enough for auth without a DB lookup
//   - For sensitive operations (password change), we still verify against DB

import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "@researchvy/shared";

// Extend FastifyRequest with the decoded JWT payload
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      userId: string;
      role: UserRole;
    };
    user: {
      userId: string;
      role: UserRole;
    };
  }
}

// Extend FastifyInstance with the authenticate decorator
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const jwtPluginDef: FastifyPluginAsync = async (fastify) => {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET environment variable is required");

  await fastify.register(fastifyJwt, {
    secret,
    sign: { expiresIn: process.env["JWT_EXPIRY"] ?? "7d" },
  });

  // Decorator: use this in route preHandler to protect endpoints
  fastify.decorate(
    "authenticate",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
      } catch {
        reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
        });
      }
    }
  );

  // Decorator: admin-only endpoints
  fastify.decorate(
    "authenticateAdmin",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
        if (req.user.role !== "ADMIN") {
          reply.code(403).send({
            success: false,
            error: { code: "FORBIDDEN", message: "Admin access required" },
          });
        }
      } catch {
        reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
        });
      }
    }
  );
};

export const jwtPlugin = fp(jwtPluginDef, { name: "jwt" });
