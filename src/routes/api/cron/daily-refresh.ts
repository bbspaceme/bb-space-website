import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/daily-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Validate CRON_SECRET from Cloudflare Cron trigger
        const expected = process.env.CRON_SECRET;
        if (!expected) {
          return new Response("Server misconfigured: CRON_SECRET not set", { status: 500 });
        }
        const provided =
          request.headers.get("x-cron-secret") ||
          request.headers.get("cf-cron-secret") ||
          new URL(request.url).searchParams.get("secret");

        if (!provided || provided !== expected) {
          return new Response("Forbidden", { status: 403 });
        }

        // Check market hours: skip weekends & after-hours
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
        const utcHour = now.getUTCHours();
        const jakartaHour = (utcHour + 7) % 24;

        // Skip weekends (IDX closed Saturday-Sunday)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          return Response.json({
            skipped: true,
            reason: "Weekend (IDX closed)",
            timestamp: now.toISOString(),
          });
        }

        // Only run during market hours (09:30 - 16:00 WIB = 02:30 - 09:00 UTC)
        // But Cloudflare runs at 09:30 UTC which is 16:30 WIB (after market close)
        // So we run after-hours for EOD refresh
        if (jakartaHour !== 16 && jakartaHour !== 17) {
          return Response.json({
            skipped: true,
            reason: `Not market hours (Jakarta: ${jakartaHour}:00, need 16:00-17:00)`,
            timestamp: now.toISOString(),
          });
        }

        try {
          // Import server function dynamically to ensure proper context
          const { refreshIntradayPrices } = await import("@/lib/market-data.functions");

          // Call server function - it will use admin client automatically
          const result = await refreshIntradayPrices({});

          return Response.json({
            success: true,
            timestamp: now.toISOString(),
            result,
          });
        } catch (error) {
          console.error("[CRON] Price refresh failed:", error);
          return Response.json(
            {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: now.toISOString(),
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
