// apps/api/src/plugins/swagger.ts
// Auto-generated API docs at /docs
// In production, disable or password-protect this route.

import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyPluginAsync } from "fastify";

const swaggerPluginDef: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "Researchvy API",
        description: "Researcher Visibility Intelligence Platform API",
        version: "1.0.0",
      },
      servers: [
        { url: "http://localhost:3001", description: "Local development" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list" },
  });
};

export const swaggerPlugin = fp(swaggerPluginDef, { name: "swagger" });
