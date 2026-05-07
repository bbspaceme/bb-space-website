import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/evaluate-price-alerts")({
  server: {
    handlers: {
      POST: async () => {
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

        let triggered = 0;
        for (const a of alerts) {
          const price = latest.get(a.ticker);
          if (price == null) continue;
          const hit =
            (a.condition === "above" && price >= Number(a.threshold)) ||
            (a.condition === "below" && price <= Number(a.threshold));
          if (!hit) continue;
          triggered++;
          await sb
            .from("price_alerts")
            .update({ triggered_at: new Date().toISOString(), is_active: false })
            .eq("id", a.id);
          await sb.from("notifications").insert({
            user_id: a.user_id,
            kind: "price_alert",
            title: `${a.ticker} ${a.condition === "above" ? "≥" : "≤"} ${Number(a.threshold).toLocaleString("id-ID")}`,
            body: `Harga terkini ${price.toLocaleString("id-ID")} memicu alert Anda.`,
            link: "/watchlist",
            metadata: { ticker: a.ticker, threshold: a.threshold, price },
          });
        }

        return Response.json({ evaluated: alerts.length, triggered });
      },
    },
  },
});
