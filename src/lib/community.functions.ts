import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authedMiddleware } from "@/lib/with-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getCommunityEquitySeries = createServerFn({ method: "POST" })
  .middleware(authedMiddleware)
  .inputValidator(z.object({ from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ data }) => {
    const { data: relevantPrices, error: relevantPricesErr } = await supabaseAdmin
      .from("eod_prices")
      .select("ticker, date, close")
      .gte("date", data.from_date)
      .order("date", { ascending: true });
    if (relevantPricesErr) throw new Error(relevantPricesErr.message);

    const relevantTickers = Array.from(new Set((relevantPrices ?? []).map((p) => p.ticker)));

    const [txnsRes, cashRes, pricesRes] = await Promise.all([
      relevantTickers.length > 0
        ? supabaseAdmin
            .from("transactions")
            .select("transacted_at, ticker, side, lot, price")
            .in("ticker", relevantTickers)
            .order("transacted_at", { ascending: true })
            .limit(20000)
        : { data: [] as { transacted_at: string; ticker: string; side: string; lot: number; price: number }[] },
      supabaseAdmin
        .from("cash_movements")
        .select("occurred_at, amount, movement_type")
        .order("occurred_at", { ascending: true })
        .limit(20000),
      relevantTickers.length > 0
        ? supabaseAdmin
            .from("eod_prices")
            .select("ticker, date, close")
            .in("ticker", relevantTickers)
            .order("date", { ascending: true })
        : { data: [] as { ticker: string; date: string; close: number }[] },
    ]);

    if (Array.isArray(txnsRes) || Array.isArray(cashRes) || Array.isArray(pricesRes)) {
      throw new Error("Unexpected response shape from Supabase");
    }

    const txns = txnsRes.data ?? [];
    const cashMoves = cashRes.data ?? [];
    const prices = pricesRes.data ?? [];

    if (txns.length === 0 && cashMoves.length === 0 && prices.length === 0) {
      return [];
    }

    if (txns.length >= 19000) {
      console.warn("[community-equity] Query mendekati limit 20k rows, pertimbangkan pagination");
    }

    const pricesByTicker = new Map<string, { date: string; close: number }[]>();
    for (const p of prices) {
      const arr = pricesByTicker.get(p.ticker) ?? [];
      arr.push({ date: p.date, close: Number(p.close) });
      pricesByTicker.set(p.ticker, arr);
    }

    const dateSet = new Set<string>();
    for (const t of txns) if (t.transacted_at >= data.from_date) dateSet.add(t.transacted_at);
    for (const c of cashMoves) if (c.occurred_at >= data.from_date) dateSet.add(c.occurred_at);
    for (const p of prices) if (p.date >= data.from_date) dateSet.add(p.date);
    const dates = Array.from(dateSet).sort();
    if (dates.length === 0) return [];

    const txnsByDate = new Map<string, typeof txns>();
    for (const t of txns) {
      const arr = txnsByDate.get(t.transacted_at) ?? [];
      arr.push(t);
      txnsByDate.set(t.transacted_at, arr);
    }

    const cashByDate = new Map<string, typeof cashMoves>();
    for (const c of cashMoves) {
      const arr = cashByDate.get(c.occurred_at) ?? [];
      arr.push(c);
      cashByDate.set(c.occurred_at, arr);
    }

    const lots = new Map<string, number>();
    let cash = 0;
    let netDeposits = 0;

    const allDatesEver = new Set<string>();
    for (const t of txns) allDatesEver.add(t.transacted_at);
    for (const c of cashMoves) allDatesEver.add(c.occurred_at);
    const everSorted = Array.from(allDatesEver).sort();

    const findPriceAtOrBefore = (ticker: string, date: string): number | null => {
      const arr = pricesByTicker.get(ticker);
      if (!arr || arr.length === 0) return null;
      let lo = 0;
      let hi = arr.length - 1;
      let best = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid].date <= date) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return best >= 0 ? arr[best].close : null;
    };

    const series: { date: string; Equity: number; Holdings: number; "P/L": number }[] = [];
    for (const date of everSorted) {
      for (const t of txnsByDate.get(date) ?? []) {
        const lot = t.side === "BUY" ? t.lot : -t.lot;
        lots.set(t.ticker, (lots.get(t.ticker) ?? 0) + lot);
        const notional = Number(t.price) * t.lot * 100;
        cash += t.side === "BUY" ? -notional : notional;
      }
      for (const c of cashByDate.get(date) ?? []) {
        const amt = Number(c.amount);
        cash += amt;
        if (c.movement_type === "DEPOSIT") netDeposits += amt;
        else if (c.movement_type === "WITHDRAW") netDeposits += amt;
      }

      if (date < data.from_date) continue;

      let holdings = 0;
      for (const [ticker, lot] of lots) {
        if (lot === 0) continue;
        const price = findPriceAtOrBefore(ticker, date);
        if (price != null) holdings += price * lot * 100;
      }

      const equity = holdings + cash;
      series.push({
        date,
        Equity: Math.round(equity),
        Holdings: Math.round(holdings),
        "P/L": Math.round(equity - netDeposits),
      });
    }

    return series;
  });
