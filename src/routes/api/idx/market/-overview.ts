import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export const runtime = "edge";

export async function GET() {
  try {
    // Get latest index performance
    const { data: indices } = await supabase
      .from("v_idx_index_performance")
      .select("*")
      .order("index_code");

    // Get top gainers
    const { data: gainers } = await supabase
      .from("v_idx_latest_prices")
      .select("ticker,name,sector,close,prev_close,price_change_pct")
      .not("prev_close", "is", null)
      .order("price_change_pct", { ascending: false })
      .limit(10);

    // Get top losers
    const { data: losers } = await supabase
      .from("v_idx_latest_prices")
      .select("ticker,name,sector,close,prev_close,price_change_pct")
      .not("prev_close", "is", null)
      .order("price_change_pct", { ascending: true })
      .limit(10);

    // Get most active by volume
    const { data: active } = await supabase
      .from("v_idx_latest_prices")
      .select("ticker,name,sector,close,volume")
      .not("volume", "is", null)
      .order("volume", { ascending: false })
      .limit(10);

    // Get sector performance
    const { data: sectorStats } = await supabase
      .from("v_idx_screener")
      .select("sector,market_cap,per,roe,price_change_pct")
      .not("sector", "is", null);

    interface SectorStatRow {
      sector: string | null;
      market_cap?: number | null;
      per?: number | null;
      roe?: number | null;
      price_change_pct?: number | null;
    }

    interface SectorAggregation {
      sector: string;
      count: number;
      totalMcap: number;
      avgPer: number[];
      avgRoe: number[];
      avgChange: number[];
    }

    // Aggregate by sector
    const sectorMap: Record<string, SectorAggregation> = {};
    if (sectorStats) {
      for (const row of sectorStats as SectorStatRow[]) {
        if (!row.sector) continue;
        const sectorKey = row.sector;
        if (!sectorMap[sectorKey]) {
          sectorMap[sectorKey] = {
            sector: sectorKey,
            count: 0,
            totalMcap: 0,
            avgPer: [],
            avgRoe: [],
            avgChange: [],
          };
        }
        const bucket = sectorMap[sectorKey];
        bucket.count++;
        bucket.totalMcap += row.market_cap ?? 0;
        if (typeof row.per === "number") bucket.avgPer.push(row.per);
        if (typeof row.roe === "number") bucket.avgRoe.push(row.roe);
        if (typeof row.price_change_pct === "number") bucket.avgChange.push(row.price_change_pct);
      }
    }

    // Calculate averages
    const sectors = Object.values(sectorMap)
      .map((s) => ({
        sector: s.sector,
        count: s.count,
        marketCap: s.totalMcap,
        avgPer: s.avgPer.length > 0 ? s.avgPer.reduce((a, b) => a + b, 0) / s.avgPer.length : 0,
        avgRoe: s.avgRoe.length > 0 ? s.avgRoe.reduce((a, b) => a + b, 0) / s.avgRoe.length : 0,
        avgChange:
          s.avgChange.length > 0 ? s.avgChange.reduce((a, b) => a + b, 0) / s.avgChange.length : 0,
      }))
      .sort((a, b) => b.marketCap - a.marketCap);

    const response = {
      timestamp: new Date().toISOString(),
      indices: indices ?? [],
      gainers: gainers ?? [],
      losers: losers ?? [],
      mostActive: active ?? [],
      sectors: sectors,
      summary: {
        totalIndices: indices?.length ?? 0,
        gainersCount: gainers?.length ?? 0,
        losersCount: losers?.length ?? 0,
        activeTickers: active?.length ?? 0,
        totalSectors: sectors.length,
      },
    };

    return NextResponse.json(response, {
      headers: {
        // Cache market overview for 5 minutes
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
