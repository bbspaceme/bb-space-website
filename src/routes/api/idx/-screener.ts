import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    let query = supabase.from("v_idx_screener").select("*");

    // Apply filters
    const sector = searchParams.get("sector");
    const board = searchParams.get("board");
    const maxPer = searchParams.get("max_per");
    const minPer = searchParams.get("min_per");
    const maxPbv = searchParams.get("max_pbv");
    const minPbv = searchParams.get("min_pbv");
    const minRoe = searchParams.get("min_roe");
    const minDivYield = searchParams.get("min_div_yield");
    const maxDer = searchParams.get("max_der");
    const minMarketCap = searchParams.get("min_market_cap");

    const sortBy = searchParams.get("sort_by") ?? "market_cap";
    const sortOrder = searchParams.get("sort_order") ?? "desc";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

    // Apply sector filter
    if (sector && sector.length > 0) {
      query = query.eq("sector", sector);
    }

    // Apply board filter
    if (board && board.length > 0) {
      query = query.eq("board", board);
    }

    // Apply PER filter
    if (minPer) {
      query = query.gte("per", parseFloat(minPer));
    }
    if (maxPer) {
      query = query.lte("per", parseFloat(maxPer));
    }

    // Apply PBV filter
    if (minPbv) {
      query = query.gte("pbv", parseFloat(minPbv));
    }
    if (maxPbv) {
      query = query.lte("pbv", parseFloat(maxPbv));
    }

    // Apply ROE filter
    if (minRoe) {
      query = query.gte("roe", parseFloat(minRoe));
    }

    // Apply dividend yield filter
    if (minDivYield) {
      query = query.gte("dividend_yield", parseFloat(minDivYield));
    }

    // Apply DER filter
    if (maxDer) {
      query = query.lte("der", parseFloat(maxDer));
    }

    // Apply market cap filter
    if (minMarketCap) {
      query = query.gte("market_cap", parseInt(minMarketCap));
    }

    // Only stocks with valid prices
    query = query.not("price", "is", null);

    // Execute query with sorting and limit
    const { data, error } = await query
      .order(sortBy, { ascending: sortOrder === "asc" })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        data: data ?? [],
        count: data?.length ?? 0,
        filters: {
          sector,
          board,
          per: { min: minPer, max: maxPer },
          pbv: { min: minPbv, max: maxPbv },
          roe: { min: minRoe },
          dividend_yield: { min: minDivYield },
          der: { max: maxDer },
          market_cap: { min: minMarketCap },
          sort: { by: sortBy, order: sortOrder },
          limit,
        },
      },
      {
        headers: {
          // Cache screener results for 5 minutes
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
