<<<<<<< HEAD
/**
 * Health Check Endpoint for Uptime Monitoring
 *
 * This endpoint provides meaningful health status for:
 * - Uptime monitoring services (Better Uptime, UptimeRobot)
 * - Cloudflare Page Rules
 * - Application performance monitoring
 *
 * Endpoint: GET /api/public/health
 * No authentication required
 * Response time: <100ms
 */

import { createAPIHandler } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  version: string;
  uptime: string;
  checks: {
    database: "ok" | "error";
    cacheKv?: "ok" | "error";
  };
  metrics?: {
    responseTime: number;
    dbLatency: number;
  };
}

const STARTUP_TIME = Date.now();

export const getHealth = createAPIHandler({
  responseType: "json",
})(async (req, ctx) => {
  const startTime = performance.now();
  const result: HealthCheckResult = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.VITE_APP_VERSION || "unknown",
    uptime: formatUptime(Date.now() - STARTUP_TIME),
    checks: {
      database: "ok",
    },
  };

  try {
    // 1. Database connectivity check
    const dbStart = performance.now();
    const dbCheck = await Promise.race([
      supabaseAdmin.from("profiles").select("id", { head: true, count: "exact" }).limit(1),
      new Promise((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 5000)),
    ]).catch((err) => {
      console.error("[Health Check] Database error:", err);
      return { error: true };
    });

    const dbLatency = performance.now() - dbStart;

    if (dbCheck && !("error" in dbCheck)) {
      result.checks.database = "ok";
    } else {
      result.checks.database = "error";
      result.status = "degraded";
    }

    // 2. KV cache check (if binding available)
    if (ctx.env?.RATE_LIMIT_KV) {
      const kvStart = performance.now();
      try {
        await ctx.env.RATE_LIMIT_KV.get("health-check-test");
        result.checks.cacheKv = "ok";
      } catch (err) {
        console.error("[Health Check] KV error:", err);
        result.checks.cacheKv = "error";
        result.status = "degraded";
      }
    }

    // 3. Overall status determination
    if (result.checks.database === "error") {
      result.status = "error";
    }

    // 4. Metrics
    const responseTime = performance.now() - startTime;
    result.metrics = {
      responseTime,
      dbLatency,
    };

    // Log slow health checks
    if (responseTime > 1000) {
      console.warn("[Health Check] Slow response:", {
        responseTime,
        dbLatency,
        checks: result.checks,
      });
    }

    // Return status code based on health
    const statusCode = result.status === "ok" ? 200 : result.status === "degraded" ? 503 : 500;

    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("[Health Check] Unexpected error:", error);

    return new Response(
      JSON.stringify({
        status: "error",
        timestamp: new Date().toISOString(),
        version: process.env.VITE_APP_VERSION || "unknown",
        uptime: formatUptime(Date.now() - STARTUP_TIME),
        checks: {
          database: "error",
        },
        error: error instanceof Error ? error.message : "Unknown error",
      } as HealthCheckResult),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      },
    );
  }
});

/**
 * Format uptime duration in human-readable format
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
=======
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Check database connection
          const { data, error } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .limit(1);

          const dbOk = !error;

          return Response.json({
            status: dbOk ? "ok" : "degraded",
            version: process.env.APP_VERSION || "1.0.0",
            timestamp: new Date().toISOString(),
            database: dbOk ? "healthy" : "unhealthy",
          }, { status: dbOk ? 200 : 503 });
        } catch (err) {
          return Response.json({
            status: "error",
            version: process.env.APP_VERSION || "1.0.0",
            timestamp: new Date().toISOString(),
            database: "unhealthy",
            error: "Database connection failed",
          }, { status: 503 });
        }
      }
    }
  }
});
>>>>>>> 4504ffcdf858f3f850d6210db5a5291b0584d44a
