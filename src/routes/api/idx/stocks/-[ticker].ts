import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export const runtime = "edge";

export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "1y";

  // Map periods to days
  const periodMap: Record<string, number> = {
    "1w": 7,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
  };

  const days = periodMap[period] ?? 365;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split("T")[0];

  try {
    // Fetch price history
    const { data: prices, error: priceError } = await supabase
      .from("idx_stock_prices")
      .select("date,open,high,low,close,volume")
      .eq("ticker", ticker)
      .gte("date", startStr)
      .order("date", { ascending: true });

    if (priceError) {
      return NextResponse.json(
        { error: `Failed to fetch prices: ${priceError.message}` },
        { status: 500 },
      );
    }

    // Fetch company info
    const { data: company, error: companyError } = await supabase
      .from("idx_companies")
      .select("*")
      .eq("ticker", ticker)
      .single();

    if (companyError && companyError.code !== "PGRST116") {
      // PGRST116 = no rows returned (company not found), that's ok
      console.warn(`Company fetch warning: ${companyError.message}`);
    }

    // Fetch latest ratios
    const { data: ratios } = await supabase
      .from("idx_financial_ratios")
      .select("*")
      .eq("ticker", ticker)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    // Fetch latest technical indicators
    const { data: technical } = await supabase
      .from("idx_technical_indicators")
      .select("*")
      .eq("ticker", ticker)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    const response = {
      ticker,
      company: company ?? null,
      ratios: ratios ?? null,
      technical: technical ?? null,
      prices: prices ?? [],
      meta: {
        period,
        total_days: prices?.length ?? 0,
        start_date: startStr,
        last_update: new Date().toISOString(),
      },
    };

    return NextResponse.json(response, {
      headers: {
        // Cache price data for 15 minutes
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
