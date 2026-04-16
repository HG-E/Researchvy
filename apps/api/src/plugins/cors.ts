// apps/api/src/plugins/cors.ts
import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";

const corsPluginDef: FastifyPluginAsync = async (fastify) => {
  const allowedOrigins =
    process.env["NODE_ENV"] === "production"
      ? [
          // TODO: replace with your actual production domain
          "https://researchvy.com",
          "https://www.researchvy.com",
        ]
      : ["http://localhost:3000"];

  await fastify.register(cors, {
    origin: allowedOrigins,
    // Allow credentials (cookies / auth headers)
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
};

export const corsPlugin = fp(corsPluginDef, { name: "cors" });
