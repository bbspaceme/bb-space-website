import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getUptimeMs() {
  if (typeof process !== "undefined" && typeof process.uptime === "function") {
    return Math.round(process.uptime() * 1000);
  }

  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return Math.round(performance.now());
  }

  return null;
}

function getKvStatus() {
  if (typeof globalThis === "undefined" || !("KV" in globalThis)) {
    return "unavailable";
  }

  try {
    const kv = (globalThis as any).KV as KVNamespace;
    if (!kv) return "unavailable";
    return "available";
  } catch {
    return "unavailable";
  }
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const version = process.env.APP_VERSION || "1.0.0";
        const uptimeMs = getUptimeMs();
        const kvStatus = getKvStatus();
        const environment = process.env.APP_ENV || process.env.NODE_ENV || "unknown";

        try {
          const { error } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .limit(1);

          const dbOk = !error;

          return Response.json(
            {
              status: dbOk ? "ok" : "degraded",
              version,
              environment,
              timestamp: new Date().toISOString(),
              uptime_ms: uptimeMs,
              database: dbOk ? "healthy" : "unhealthy",
              kv: kvStatus,
            },
            { status: dbOk ? 200 : 503 },
          );
        } catch (error) {
          return Response.json(
            {
              status: "error",
              version,
              environment,
              timestamp: new Date().toISOString(),
              uptime_ms: uptimeMs,
              database: "unhealthy",
              kv: kvStatus,
              error: (error as Error)?.message || "Database connection failed",
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
