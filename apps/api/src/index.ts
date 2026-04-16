// apps/api/src/index.ts
// Fastify application entry point.
//
// Why Fastify over Express?
//   - Schema-based validation out of the box (faster than runtime checks)
//   - 2-3x higher throughput than Express in benchmarks
//   - First-class TypeScript support with typed request/reply
//   - Plugin system enforces clean separation of concerns

import Fastify from "fastify";
import { prismaPlugin } from "./plugins/prisma.js";
import { corsPlugin } from "./plugins/cors.js";
import { jwtPlugin } from "./plugins/jwt.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";
import { swaggerPlugin } from "./plugins/swagger.js";
import { authRoutes } from "./routes/auth.js";
import { researcherRoutes } from "./routes/researchers.js";
import { publicationRoutes } from "./routes/publications.js";
import { visibilityRoutes } from "./routes/visibility.js";
import { syncRoutes } from "./routes/sync.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { pingRoute } from "./routes/ping.js";

const PORT = Number(process.env["API_PORT"] ?? 3001);
const HOST = process.env["API_HOST"] ?? "0.0.0.0";

async function buildApp() {
  const app = Fastify({
    // Use pino logger — structured JSON logs, plays well with log aggregators
    logger: {
      level: process.env["NODE_ENV"] === "production" ? "info" : "debug",
      transport:
        process.env["NODE_ENV"] !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
    // Trust the X-Forwarded-For header when behind a proxy (e.g. nginx, ALB)
    trustProxy: process.env["NODE_ENV"] === "production",
  });

  // ── Plugins (order matters — each plugin is scoped to what's registered after it)
  await app.register(prismaPlugin);
  await app.register(corsPlugin);
  await app.register(jwtPlugin);
  await app.register(rateLimitPlugin);
  await app.register(swaggerPlugin);

  // ── Routes — all prefixed under /api/v1
  await app.register(authRoutes,        { prefix: "/api/v1/auth" });
  await app.register(researcherRoutes,  { prefix: "/api/v1/researchers" });
  await app.register(publicationRoutes, { prefix: "/api/v1/publications" });
  await app.register(visibilityRoutes,  { prefix: "/api/v1/visibility" });
  await app.register(syncRoutes,        { prefix: "/api/v1/sync" });
  await app.register(dashboardRoutes,   { prefix: "/api/v1/dashboard" });

  // ── Ping (keeps free Render instance warm via UptimeRobot — no auth)
  await app.register(pingRoute);

  // ── Health check (no auth — used by load balancers + uptime monitors)
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env["npm_package_version"] ?? "unknown",
  }));

  return app;
}

// Start server unless this module is imported in tests
const app = await buildApp();

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`🚀 Researchvy API running at http://${HOST}:${PORT}`);
  app.log.info(`📚 Swagger docs: http://localhost:${PORT}/docs`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export { buildApp };
