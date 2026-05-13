import { z } from "zod";
import { z } from "zod";
import { authedMiddleware } from "@/lib/with-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ============ Economic Events ============
  .middleware(authedMiddleware)
  .inputValidator((d: { from?: string; to?: string; country?: string } | undefined) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        country: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("economic_events")
      .select("*")
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true })
      .limit(500);
    if (data.from) q = q.gte("event_date", data.from);
    if (data.to) q = q.lte("event_date", data.to);
    if (data.country) q = q.eq("country", data.country);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

// ============ Macro indicators ============
  .middleware(authedMiddleware)
  .inputValidator((d: { country?: string; indicator?: string }) =>
    z.object({ country: z.string().default("IDN"), indicator: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("macro_indicators")
      .select("period, value, unit, source")
      .eq("country", data.country)
      .eq("indicator", data.indicator)
      .order("period", { ascending: true })
      .limit(500);
    if (error) throw error;
    return rows ?? [];
  });

// ============ ETL: FRED ingest (admin/advisor only) ============
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

  .middleware(authedMiddleware)
  .inputValidator((d: { series_id: string; indicator: string; country?: string; unit?: string }) =>
    z
      .object({
        series_id: z.string().min(1),
        indicator: z.string().min(1),
        country: z.string().default("USA"),
        unit: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("advisor")) {
      throw new Error("Forbidden");
    }

    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) throw new Error("FRED_API_KEY not set");

    const url = `${FRED_BASE}?series_id=${encodeURIComponent(data.series_id)}&api_key=${apiKey}&file_type=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FRED HTTP ${res.status}`);
    const json = (await res.json()) as { observations?: Array<{ date: string; value: string }> };
    const obs = (json.observations ?? []).filter((o) => o.value !== ".");
    if (obs.length === 0) return { inserted: 0 };

    const rows = obs.map((o) => ({
      country: data.country,
      indicator: data.indicator,
      period: o.date,
      value: Number(o.value),
      unit: data.unit ?? null,
      source: "FRED",
      metadata: { series_id: data.series_id },
    }));

    const { error } = await supabaseAdmin
      .from("macro_indicators")
      .upsert(rows, { onConflict: "country,indicator,period,source" });
    if (error) throw error;
    return { inserted: rows.length };
  });
