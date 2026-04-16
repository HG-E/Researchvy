// apps/api/src/routes/ping.ts
// Lightweight ping endpoint used by UptimeRobot to keep the free
// Render instance warm (prevents the 30s cold start on free tier).
//
// UptimeRobot (uptimerobot.com — free) pings this URL every 14 minutes.
// Render sleeps after 15 minutes of inactivity → 14min ping keeps it awake.
// Setup: uptimerobot.com → Add Monitor → HTTP(s) → URL: https://api.yourdomain.com/ping

import type { FastifyPluginAsync } from "fastify";

export const pingRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/ping", async () => ({
    ok: true,
    ts: Date.now(),
  }));
};
