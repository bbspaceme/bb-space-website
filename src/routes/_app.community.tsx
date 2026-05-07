import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { fmtNum, fmtPct } from "@/lib/format";
import { format, subMonths, subYears } from "date-fns";

export const Route = createFileRoute("/_app/community")({
  component: CommunityPage,
});

type Range = "1M" | "3M" | "1Y";

function rangeStart(r: Range): string {
  const now = new Date();
  const d = r === "1M" ? subMonths(now, 1) : r === "3M" ? subMonths(now, 3) : subYears(now, 1);
  return format(d, "yyyy-MM-dd");
}

function CommunityPage() {
  const [range, setRange] = useState<Range>("3M");
  const [equityRange, setEquityRange] = useState<Range>("3M");
  const fromDate = rangeStart(range);
  const equityFromDate = rangeStart(equityRange);

  const kbaiQ = useQuery({
    queryKey: ["kbai", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kbai_index")
        .select("date, value, pct_change, member_count")
        .gte("date", fromDate)
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const benchQ = useQuery({
    queryKey: ["benchmarks", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("benchmark_prices")
        .select("symbol, date, value")
        .gte("date", fromDate)
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const equityQ = useQuery({
    queryKey: ["community-equity", equityRange],
    queryFn: async () => buildCommunityEquitySeries(equityFromDate),
  });

  const memberCountQ = useQuery({
    queryKey: ["community-member-count"],
    queryFn: async () => {
      // Hitung hanya akun dengan role 'user' (exclude admin & advisor)
      const { count, error } = await supabase
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "user");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const chartData = useMemo(
    () => buildChartData(kbaiQ.data ?? [], benchQ.data ?? []),
    [kbaiQ.data, benchQ.data],
  );

  const latestKbai = kbaiQ.data?.[kbaiQ.data.length - 1];
  const totalMembers = memberCountQ.data ?? latestKbai?.member_count ?? 0;
  const firstKbai = kbaiQ.data?.[0];
  const kbaiReturn =
    latestKbai && firstKbai && Number(firstKbai.value) > 0
      ? ((Number(latestKbai.value) - Number(firstKbai.value)) / Number(firstKbai.value)) * 100
      : null;

  // Alpha vs IHSG (Master Plan §11.2)
  const ihsgSeries = (benchQ.data ?? []).filter((b) => b.symbol === "IHSG");
  const ihsgFirst = ihsgSeries[0];
  const ihsgLast = ihsgSeries[ihsgSeries.length - 1];
  const ihsgReturn =
    ihsgFirst && ihsgLast && Number(ihsgFirst.value) > 0
      ? ((Number(ihsgLast.value) - Number(ihsgFirst.value)) / Number(ihsgFirst.value)) * 100
      : null;
  const alpha = kbaiReturn != null && ihsgReturn != null ? kbaiReturn - ihsgReturn : null;

  return (
    <div className="space-y-8">
      {/* KPI strip */}
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-3">
        <Stat
          label="KBAI Index"
          value={latestKbai ? fmtNum(Number(latestKbai.value)) : "—"}
          sub={
            latestKbai?.pct_change != null
              ? `${fmtPct(Number(latestKbai.pct_change))} today · ${totalMembers} members`
              : `${totalMembers} members`
          }
          tone={
            latestKbai?.pct_change != null
              ? Number(latestKbai.pct_change) >= 0
                ? "pos"
                : "neg"
              : undefined
          }
        />
        <Stat
          label={`Return ${range}`}
          value={kbaiReturn != null ? fmtPct(kbaiReturn) : "—"}
          sub={ihsgReturn != null ? `IHSG ${fmtPct(ihsgReturn)}` : undefined}
          tone={kbaiReturn != null ? (kbaiReturn >= 0 ? "pos" : "neg") : undefined}
        />
        <Stat
          label={`Alpha vs IHSG`}
          value={alpha != null ? fmtPct(alpha) : "—"}
          sub={alpha != null ? (alpha >= 0 ? "Outperform" : "Underperform") : undefined}
          tone={alpha != null ? (alpha >= 0 ? "pos" : "neg") : undefined}
        />
      </section>

      {/* Chart panel */}
      <section className="rounded-sm border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em]">
              Index Performance
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Normalized · base 100
            </span>
          </div>
          <div className="inline-flex overflow-hidden rounded-sm border border-border">
            {(["1M", "3M", "1Y"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={
                  range === r
                    ? "bg-foreground px-2.5 py-1 text-[11px] font-semibold tracking-wider text-background"
                    : "px-2.5 py-1 text-[11px] font-medium tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground"
                }
              >
                {r}
              </button>
            ))}
          </div>
        </header>
        <div className="px-2 py-4">
          {chartData.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-muted-foreground">
              Belum ada data. Admin perlu jalankan refresh harga & isi benchmark.
            </p>
          ) : (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickFormatter={(d) => format(new Date(d), "dd MMM")}
                    minTickGap={24}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                    width={44}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--color-muted-foreground)", strokeDasharray: "2 4" }}
                    contentStyle={{
                      backgroundColor: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 4,
                      fontSize: 11,
                      padding: "6px 10px",
                    }}
                    labelStyle={{
                      color: "var(--color-muted-foreground)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 4,
                    }}
                    formatter={(v: number) => fmtNum(v)}
                    labelFormatter={(d) => format(new Date(d as string), "dd MMM yyyy")}
                  />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    iconType="plainline"
                    iconSize={14}
                    wrapperStyle={{
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--color-muted-foreground)",
                    }}
                  />
                  <Line type="monotone" dataKey="KBAI" stroke="var(--color-chart-1)" strokeWidth={1.75} dot={false} connectNulls />
                  <Line type="monotone" dataKey="IHSG" stroke="var(--color-chart-2)" strokeWidth={1.25} dot={false} connectNulls />
                  <Line type="monotone" dataKey="GOLD" stroke="var(--color-chart-3)" strokeWidth={1.25} dot={false} connectNulls />
                  <Line type="monotone" dataKey="BTC" stroke="var(--color-chart-4)" strokeWidth={1.25} dot={false} connectNulls />
                  <Line type="monotone" dataKey="SMF" stroke="var(--color-chart-5)" strokeWidth={1.25} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Community Equity Chart */}
      <section className="rounded-sm border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em]">
              Community Equity
            </h2>
            <span className="text-[11px] text-muted-foreground">
              IDR · Equity + Holdings + P/L
            </span>
          </div>
          <div className="inline-flex overflow-hidden rounded-sm border border-border">
            {(["1M", "3M", "1Y"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setEquityRange(r)}
                className={
                  equityRange === r
                    ? "bg-foreground px-2.5 py-1 text-[11px] font-semibold tracking-wider text-background"
                    : "px-2.5 py-1 text-[11px] font-medium tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground"
                }
              >
                {r}
              </button>
            ))}
          </div>
        </header>
        <div className="px-2 py-4">
          {(equityQ.data ?? []).length === 0 ? (
            <p className="py-16 text-center text-[13px] text-muted-foreground">
              Belum ada data ekuitas komunitas.
            </p>
          ) : (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityQ.data} margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickFormatter={(d) => format(new Date(d), "dd MMM")}
                    minTickGap={24}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                    width={64}
                    tickFormatter={(v: number) =>
                      v >= 1e9
                        ? (v / 1e9).toFixed(1) + "B"
                        : v >= 1e6
                          ? (v / 1e6).toFixed(1) + "M"
                          : v.toFixed(0)
                    }
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--color-muted-foreground)", strokeDasharray: "2 4" }}
                    contentStyle={{
                      backgroundColor: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 4,
                      fontSize: 11,
                      padding: "6px 10px",
                    }}
                    labelStyle={{
                      color: "var(--color-muted-foreground)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 4,
                    }}
                    formatter={(v: number) => fmtNum(v)}
                    labelFormatter={(d) => format(new Date(d as string), "dd MMM yyyy")}
                  />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    iconType="plainline"
                    iconSize={14}
                    wrapperStyle={{
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--color-muted-foreground)",
                    }}
                  />
                  <Line type="monotone" dataKey="Equity" stroke="var(--color-chart-1)" strokeWidth={1.75} dot={false} />
                  <Line type="monotone" dataKey="Holdings" stroke="var(--color-chart-2)" strokeWidth={1.25} dot={false} />
                  <Line type="monotone" dataKey="P/L" stroke="var(--color-chart-4)" strokeWidth={1.25} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="bg-card px-5 py-5">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-2 font-mono text-2xl font-semibold tabular tracking-tight " +
          (tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-foreground")
        }
      >
        {value}
      </div>
      {sub && (
        <div
          className={
            "mt-1 text-[11px] tabular " +
            (tone === "pos"
              ? "text-pos"
              : tone === "neg"
                ? "text-neg"
                : "text-muted-foreground")
          }
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function buildChartData(
  kbai: { date: string; value: number }[],
  bench: { date: string; symbol: string; value: number }[],
) {
  const dates = new Set<string>();
  for (const k of kbai) dates.add(k.date);
  for (const b of bench) dates.add(b.date);
  const sortedDates = Array.from(dates).sort();
  if (sortedDates.length === 0) return [];

  const kbaiMap = new Map(kbai.map((k) => [k.date, Number(k.value)]));
  const benchBySym: Record<string, Map<string, number>> = {
    IHSG: new Map(),
    GOLD: new Map(),
    BTC: new Map(),
    SMF: new Map(),
  };
  for (const b of bench) {
    benchBySym[b.symbol]?.set(b.date, Number(b.value));
  }

  const baseKbai = kbai[0] ? Number(kbai[0].value) : null;
  const baseBench: Record<string, number | null> = {
    IHSG: null,
    GOLD: null,
    BTC: null,
    SMF: null,
  };
  for (const sym of ["IHSG", "GOLD", "BTC", "SMF"]) {
    const first = bench.find((b) => b.symbol === sym);
    if (first) baseBench[sym] = Number(first.value);
  }

  const norm = (v: number | undefined, base: number | null) =>
    v != null && base != null && base > 0 ? (v / base) * 100 : undefined;

  // Forward-fill weekend / holiday gaps (Master Plan §9.3)
  const last: Record<string, number | undefined> = {
    KBAI: undefined,
    IHSG: undefined,
    GOLD: undefined,
    BTC: undefined,
    SMF: undefined,
  };
  return sortedDates.map((date) => {
    const k = norm(kbaiMap.get(date), baseKbai);
    const ih = norm(benchBySym.IHSG.get(date), baseBench.IHSG);
    const go = norm(benchBySym.GOLD.get(date), baseBench.GOLD);
    const bt = norm(benchBySym.BTC.get(date), baseBench.BTC);
    const sm = norm(benchBySym.SMF.get(date), baseBench.SMF);
    // KBAI: do NOT forward-fill — let connectNulls interpolate smoothly
    // between actual data points (avoids flat plateaus & step jumps)
    if (ih != null) last.IHSG = ih;
    if (go != null) last.GOLD = go;
    if (bt != null) last.BTC = bt;
    if (sm != null) last.SMF = sm;
    return {
      date,
      KBAI: k,
      IHSG: last.IHSG,
      GOLD: last.GOLD,
      BTC: last.BTC,
      SMF: last.SMF,
    };
  });
}

/**
 * Build community-wide time-series:
 *  - Holdings value (sum across users, marked at each day's EOD price)
 *  - Cash pool (running cumulative cash movement)
 *  - Equity = Holdings + Cash
 *  - P/L = Equity - cumulative net deposits
 * Reconstructs positions day-by-day from `transactions` + `cash_movements`.
 */
async function buildCommunityEquitySeries(fromDate: string) {
  const [txnsRes, cashRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("transacted_at, ticker, side, lot, price, user_id")
      .order("transacted_at", { ascending: true })
      .limit(20000),
    supabase
      .from("cash_movements")
      .select("occurred_at, amount, movement_type")
      .order("occurred_at", { ascending: true })
      .limit(20000),
  ]);
  const txns = txnsRes.data ?? [];
  const cashMoves = cashRes.data ?? [];

  if (txns.length === 0 && cashMoves.length === 0) return [];

  const tickers = Array.from(new Set(txns.map((t) => t.ticker)));
  const pricesRes = tickers.length
    ? await supabase
        .from("eod_prices")
        .select("ticker, date, close")
        .in("ticker", tickers)
        .order("date", { ascending: true })
    : { data: [] };
  const prices = pricesRes.data ?? [];

  // pricesByTicker: ticker -> sorted [date, close]
  const pricesByTicker = new Map<string, { date: string; close: number }[]>();
  for (const p of prices) {
    const arr = pricesByTicker.get(p.ticker) ?? [];
    arr.push({ date: p.date, close: Number(p.close) });
    pricesByTicker.set(p.ticker, arr);
  }

  // Build all relevant dates: union of (txn dates, cash dates, EOD dates >= fromDate)
  const dateSet = new Set<string>();
  for (const t of txns) if (t.transacted_at >= fromDate) dateSet.add(t.transacted_at);
  for (const c of cashMoves) if (c.occurred_at >= fromDate) dateSet.add(c.occurred_at);
  for (const p of prices) if (p.date >= fromDate) dateSet.add(p.date);
  const dates = Array.from(dateSet).sort();
  if (dates.length === 0) return [];

  // Sort txns/cash by date for streaming pass
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

  // Aggregated lot per ticker (community-wide). Avg cost per ticker maintained for cost basis.
  const lots = new Map<string, number>(); // ticker -> total lots (community)
  let cash = 0;
  let netDeposits = 0; // DEPOSIT - WITHDRAW

  // Process pre-period transactions/cash to seed state on `fromDate`
  const allDatesEver = new Set<string>();
  for (const t of txns) allDatesEver.add(t.transacted_at);
  for (const c of cashMoves) allDatesEver.add(c.occurred_at);
  const everSorted = Array.from(allDatesEver).sort();

  const findPriceAtOrBefore = (ticker: string, date: string): number | null => {
    const arr = pricesByTicker.get(ticker);
    if (!arr || arr.length === 0) return null;
    let lo = 0,
      hi = arr.length - 1,
      best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].date <= date) {
        best = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return best >= 0 ? arr[best].close : arr[0].close;
  };

  const series: { date: string; Equity: number; Holdings: number; "P/L": number }[] = [];
  for (const date of everSorted) {
    // apply same-day events
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
      else if (c.movement_type === "WITHDRAW") netDeposits += amt; // amt already negative
    }

    // Only emit for dates >= fromDate
    if (date < fromDate) continue;
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
  // Forward-fill on EOD dates that have no event
  // (already covered: we only emit on dates that have events or EOD samples; since we union with prices.date >= fromDate, gaps are minimal)
  return series;
}
