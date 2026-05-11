import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks
 * Timing attacks can leak secret bytes by measuring response time
 */
function timingSafeCompare(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;

  // Both must be same length for timing-safe comparison
  if (provided.length !== expected.length) return false;

  try {
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    return timingSafeEqual(providedBuf, expectedBuf);
  } catch (error) {
    // If buffer creation fails, return false
    return false;
  }
}

export const Route = createFileRoute("/api/public/evaluate-price-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Validate CRON_SECRET with timing-safe comparison
        const expected = process.env.CRON_SECRET;
        if (!expected) {
          return new Response("Server misconfigured: CRON_SECRET not set", { status: 500 });
        }

        const provided = request.headers.get("x-cron-secret");

        // Use constant-time comparison to prevent timing attacks
        if (!timingSafeCompare(provided || "", expected)) {
          // Return same status code and generic message as successful auth
          // to prevent attacker from detecting secrets via response time
          return new Response("Unauthorized", { status: 401 });
        }

        const sb = supabaseAdmin;

        const { data: alerts } = await sb
          .from("price_alerts")
          .select("*")
          .eq("is_active", true)
          .is("triggered_at", null);

        if (!alerts || alerts.length === 0) {
          return Response.json({ evaluated: 0, triggered: 0 });
        }

        const tickers = Array.from(new Set(alerts.map((a) => a.ticker)));
        const { data: prices } = await sb
          .from("eod_prices")
          .select("ticker, close, date")
          .in("ticker", tickers)
          .order("date", { ascending: false });

        const latest = new Map<string, number>();
        for (const p of prices ?? []) {
          if (!latest.has(p.ticker)) latest.set(p.ticker, Number(p.close));
        }

        // PERF-01: collect triggered alerts then batch the writes
        const now = new Date().toISOString();
        const triggeredAlerts = alerts.filter((a) => {
          const price = latest.get(a.ticker);
          if (price == null) return false;
          return (
            (a.condition === "above" && price >= Number(a.threshold)) ||
            (a.condition === "below" && price <= Number(a.threshold))
          );
        });

        if (triggeredAlerts.length > 0) {
          await Promise.all([
            // Update each alert (Supabase upsert needs full row; use update per id in parallel)
            Promise.all(
              triggeredAlerts.map((a) =>
                sb
                  .from("price_alerts")
                  .update({ triggered_at: now, is_active: false })
                  .eq("id", a.id),
              ),
            ),
            sb.from("notifications").insert(
              triggeredAlerts.map((a) => {
                const price = latest.get(a.ticker)!;
                return {
                  user_id: a.user_id,
                  kind: "price_alert",
                  title: `${a.ticker} ${a.condition === "above" ? "≥" : "≤"} ${Number(a.threshold).toLocaleString("id-ID")}`,
                  body: `Harga terkini ${price.toLocaleString("id-ID")} memicu alert Anda.`,
                  link: "/watchlist",
                  metadata: { ticker: a.ticker, threshold: a.threshold, price },
                };
              }),
            ),
          ]);
        }

        return Response.json({ evaluated: alerts.length, triggered: triggeredAlerts.length });
      },
    },
  },
});
