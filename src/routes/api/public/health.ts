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