// apps/api/src/plugins/prisma.ts
// Registers a single PrismaClient instance on the Fastify instance.
//
// Why singleton?
//   - Prisma manages a connection pool internally.
//   - Creating multiple PrismaClient instances leaks connections.
//   - Fastify plugins with fastify-plugin() are registered in the same scope
//     as the parent — so prisma is accessible on every route handler.

import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPluginDef: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log:
      process.env["NODE_ENV"] === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

  await prisma.$connect();

  // Decorate the Fastify instance — accessible as `fastify.prisma` in all routes
  fastify.decorate("prisma", prisma);

  // Cleanly disconnect when the server shuts down
  fastify.addHook("onClose", async (instance) => {
    await instance.prisma.$disconnect();
  });
};

// fastify-plugin unwraps the plugin scope so it's available globally
export const prismaPlugin = fp(prismaPluginDef, {
  name: "prisma",
});
