import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { fmtIDR, fmtNum, fmtPct } from "@/lib/format";
import { adjustCash, refreshEodPrices, submitTransaction } from "@/lib/portfolio.functions";
import { toast } from "sonner";
import { RefreshCw, Plus, Minus, Wallet, Briefcase, Sparkles, FileDown } from "lucide-react";
import { exportPortfolioPdf } from "@/lib/pdf-export";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { IDX_EMITEN, IDX_TICKERS } from "@/lib/idx-tickers";
import { MetricTooltip } from "@/components/metric-tooltip";

export const Route = createFileRoute("/_app/portfolio")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isAdmin = !!roles?.some((r) => String(r.role) === "admin");
    const isAdvisor = !!roles?.some((r) => String(r.role) === "advisor");
    // Admins and advisors don't have portfolios — send to dashboard
    if (isAdmin || isAdvisor) {
      throw redirect({ to: "/community" });
    }
  },
  component: PortfolioPage,
});

function PortfolioPage() {
  const auth = useAuth();
  const userId = auth.user?.id;
  const accessToken = auth.session?.access_token;
  const qc = useQueryClient();
  const [openDialog, setOpenDialog] = useState<null | "BUY" | "SELL">(null);
  const [cashOpen, setCashOpen] = useState(false);

  const cashQ = useQuery({
    queryKey: ["cash-balance", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_balances")
        .select("balance, updated_at")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? { balance: 0, updated_at: null };
    },
  });
  const cashBalance = Number(cashQ.data?.balance ?? 0);

  const holdingsQ = useQuery({
    queryKey: ["holdings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holdings")
        .select("*")
        .eq("user_id", userId!);
      if (error) throw error;
      return data;
    },
  });

  const tickers = (holdingsQ.data ?? []).map((h) => h.ticker);

  const pricesQ = useQuery({
    queryKey: ["latest-prices", tickers.sort().join(",")],
    enabled: tickers.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eod_prices")
        .select("ticker, close, date")
        .in("ticker", tickers)
        .order("date", { ascending: false });
      if (error) throw error;
      const map = new Map<string, { close: number; date: string }>();
      for (const p of data) {
        if (!map.has(p.ticker)) map.set(p.ticker, { close: Number(p.close), date: p.date });
      }
      return map;
    },
  });

  const txnsQ = useQuery({
    queryKey: ["transactions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId!)
        .order("transacted_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const refreshMut = useMutation({
    mutationFn: () =>
      refreshEodPrices({ data: accessToken ? { access_token: accessToken } : undefined }),
    onSuccess: (res) => {
      toast.success(`Harga diperbarui: ${res.updated} ticker`);
      qc.invalidateQueries({ queryKey: ["latest-prices"] });
      qc.invalidateQueries({ queryKey: ["holdings"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = (holdingsQ.data ?? []).map((h) => {
    const priceInfo = pricesQ.data?.get(h.ticker);
    const last = priceInfo?.close;
    const lot = h.total_lot;
    const avg = Number(h.avg_price);
    const value = last != null ? lot * last * 100 : null;
    const cost = lot * avg * 100;
    const pl = value != null ? value - cost : null;
    const plPct = value != null && cost > 0 ? ((value - cost) / cost) * 100 : null;
    return { ...h, last, value, cost, pl, plPct };
  });

  const totalValue = rows.reduce((s, r) => s + (r.value ?? r.cost), 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const totalEquity = totalValue + cashBalance;

  return (
    <div className="space-y-8">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setOpenDialog("BUY")}
            className="h-8 rounded-sm bg-foreground px-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-background hover:bg-foreground/90"
          >
            <Plus className="h-3.5 w-3.5" /> Buy
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpenDialog("SELL")}
            className="h-8 rounded-sm border-border px-4 text-[12px] font-semibold uppercase tracking-[0.12em] hover:bg-accent"
          >
            <Minus className="h-3.5 w-3.5" /> Sell
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCashOpen(true)}
            className="h-8 rounded-sm border-border px-4 text-[12px] font-semibold uppercase tracking-[0.12em] hover:bg-accent"
          >
            <Wallet className="h-3.5 w-3.5" /> Cash
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (rows.length === 0) {
                toast.error("Belum ada holding untuk diexport");
                return;
              }
              exportPortfolioPdf({
                username: auth.username ?? auth.user?.email ?? "user",
                asOf: new Date(),
                cash: cashBalance,
                totalValue,
                totalCost,
                positions: rows.map((r) => ({
                  ticker: r.ticker,
                  lot: r.total_lot,
                  avg: Number(r.avg_price),
                  last: r.last ?? 0,
                  value: r.value ?? r.cost,
                  pl: r.pl ?? 0,
                  plPct: r.plPct ?? 0,
                })),
              });
              toast.success("PDF snapshot diunduh");
            }}
            className="h-8 rounded-sm text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
          >
            <FileDown className="h-3.5 w-3.5" /> Export PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending}
            className="h-8 rounded-sm text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={refreshMut.isPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh prices
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Equity" value={fmtIDR(totalEquity)} sub="Holdings + Cash" tooltip="Nilai pasar holdings + saldo cash. Snapshot per harga EOD terakhir." />
        <Stat label="Market Value" value={fmtIDR(totalValue)} sub={`${rows.length} positions`} tooltip="Lot × harga EOD × 100 saham per lot." />
        <Stat label="Cash Balance" value={fmtIDR(cashBalance)} sub="Idle funds" tooltip="Saldo cash yang belum diinvestasikan, otomatis berkurang saat BUY dan bertambah saat SELL." />
        <Stat
          label="Unrealized P/L"
          value={fmtIDR(totalPL)}
          sub={fmtPct(totalPLPct)}
          tone={totalPL >= 0 ? "pos" : "neg"}
          tooltip="Selisih nilai pasar terhadap cost basis (avg price × lot × 100). Belum direalisasikan sampai SELL."
        />
      </section>

      {/* Holdings table */}
      <section className="rounded-sm border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em]">Holdings</h2>
          <span className="text-[11px] text-muted-foreground">
            1 lot = 100 shares · EOD pricing
          </span>
        </header>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-border bg-accent/50">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-semibold">Belum ada posisi</h3>
              <p className="max-w-sm text-[12px] text-muted-foreground">
                Mulai catat holding pertama Anda. Tambahkan saldo cash terlebih dahulu, lalu klik Buy untuk mencatat pembelian.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {cashBalance <= 0 && (
                <Button size="sm" variant="outline" onClick={() => setCashOpen(true)} className="h-8 rounded-sm text-[12px] uppercase tracking-[0.12em]">
                  <Wallet className="mr-1.5 h-3.5 w-3.5" /> Set Cash
                </Button>
              )}
              <Button size="sm" onClick={() => setOpenDialog("BUY")} className="h-8 rounded-sm bg-foreground text-[12px] uppercase tracking-[0.12em] text-background hover:bg-foreground/90">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Holding Pertama
              </Button>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Tip: gunakan <span className="font-mono">⌘K</span> untuk navigasi cepat.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Ticker</th>
                  <th className="px-4 py-2.5 text-right font-medium">Lot</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg Price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Last</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Market Value</th>
                  <th className="px-4 py-2.5 text-right font-medium">P/L</th>
                  <th className="px-4 py-2.5 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody className="text-[13px] tabular">
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[12px] font-semibold tracking-wide">
                        {r.ticker}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">{r.total_lot}</td>
                    <td className="px-4 py-2.5 text-right">{fmtNum(Number(r.avg_price))}</td>
                    <td className="px-4 py-2.5 text-right">
                      {r.last != null ? (
                        fmtNum(r.last)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {fmtIDR(r.cost)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {r.value != null ? fmtIDR(r.value) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-medium",
                        r.pl == null
                          ? "text-muted-foreground"
                          : r.pl >= 0
                            ? "text-pos"
                            : "text-neg",
                      )}
                    >
                      {r.pl != null ? fmtIDR(r.pl) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right",
                        r.plPct == null
                          ? "text-muted-foreground"
                          : r.plPct >= 0
                            ? "text-pos"
                            : "text-neg",
                      )}
                    >
                      {r.plPct != null ? fmtPct(r.plPct) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-accent/30 text-[12px] font-semibold uppercase tracking-[0.1em]">
                  <td className="px-4 py-2.5">Total</td>
                  <td colSpan={3}></td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {fmtIDR(totalCost)}
                  </td>
                  <td className="px-4 py-2.5 text-right">{fmtIDR(totalValue)}</td>
                  <td className={cn("px-4 py-2.5 text-right", totalPL >= 0 ? "text-pos" : "text-neg")}>
                    {fmtIDR(totalPL)}
                  </td>
                  <td className={cn("px-4 py-2.5 text-right", totalPL >= 0 ? "text-pos" : "text-neg")}>
                    {fmtPct(totalPLPct)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Performance Attribution */}
      {rows.length > 0 && totalCost > 0 && (
        <section className="rounded-sm border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em]">
              Performance Attribution
              <MetricTooltip
                term="Attribution"
                description="Kontribusi setiap holding terhadap total return portofolio. Bobot = cost share × return saham."
              />
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Total return {fmtPct(totalPLPct)}
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Ticker</th>
                  <th className="px-4 py-2.5 text-right font-medium">Weight</th>
                  <th className="px-4 py-2.5 text-right font-medium">Return</th>
                  <th className="px-4 py-2.5 text-right font-medium">Contribution</th>
                  <th className="px-4 py-2.5 font-medium">Bar</th>
                </tr>
              </thead>
              <tbody className="text-[13px] tabular">
                {rows
                  .map((r) => {
                    const weight = r.cost / totalCost;
                    const ret = r.cost > 0 && r.value != null ? (r.value - r.cost) / r.cost : 0;
                    const contrib = weight * ret * 100;
                    return { ticker: r.ticker, weight, ret, contrib };
                  })
                  .sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib))
                  .map((a) => {
                    const maxAbs = Math.max(
                      ...rows.map((r) => {
                        const w = r.cost / totalCost;
                        const re = r.cost > 0 && r.value != null ? (r.value - r.cost) / r.cost : 0;
                        return Math.abs(w * re * 100);
                      }),
                      0.01,
                    );
                    const pct = (Math.abs(a.contrib) / maxAbs) * 100;
                    return (
                      <tr key={a.ticker} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-2.5 font-mono text-[12px] font-semibold">{a.ticker}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtPct(a.weight * 100)}</td>
                        <td className={cn("px-4 py-2.5 text-right", a.ret >= 0 ? "text-pos" : "text-neg")}>
                          {fmtPct(a.ret * 100)}
                        </td>
                        <td className={cn("px-4 py-2.5 text-right font-medium", a.contrib >= 0 ? "text-pos" : "text-neg")}>
                          {a.contrib >= 0 ? "+" : ""}{a.contrib.toFixed(2)} pp
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="relative h-2 w-full bg-border/50">
                            <div
                              className={cn("absolute top-0 h-full", a.contrib >= 0 ? "bg-pos/70 left-1/2" : "bg-neg/70 right-1/2")}
                              style={{ width: `${pct / 2}%` }}
                            />
                            <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Transactions */}
      <section className="rounded-sm border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em]">
            Transaction History
          </h2>
          <span className="text-[11px] text-muted-foreground">
            Latest {(txnsQ.data ?? []).length} entries
          </span>
        </header>
        {(txnsQ.data ?? []).length === 0 ? (
          <p className="py-12 text-center text-[13px] text-muted-foreground">
            No transactions recorded.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium">Side</th>
                  <th className="px-4 py-2.5 text-left font-medium">Ticker</th>
                  <th className="px-4 py-2.5 text-right font-medium">Lot</th>
                  <th className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Notional</th>
                </tr>
              </thead>
              <tbody className="text-[13px] tabular">
                {(txnsQ.data ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {format(new Date(t.transacted_at), "dd MMM yyyy", { locale: idLocale })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-block rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
                          t.side === "BUY"
                            ? "border-pos/40 text-pos"
                            : "border-neg/40 text-neg",
                        )}
                      >
                        {t.side}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px] font-semibold tracking-wide">
                      {t.ticker}
                    </td>
                    <td className="px-4 py-2.5 text-right">{t.lot}</td>
                    <td className="px-4 py-2.5 text-right">{fmtNum(Number(t.price))}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {fmtIDR(Number(t.price) * t.lot * 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TransactionDialog
        open={openDialog !== null}
        side={openDialog ?? "BUY"}
        onClose={() => setOpenDialog(null)}
        holdings={holdingsQ.data ?? []}
        userId={userId!}
        cashBalance={cashBalance}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["holdings"] });
          qc.invalidateQueries({ queryKey: ["transactions"] });
          qc.invalidateQueries({ queryKey: ["cash-balance"] });
        }}
      />
      <CashDialog
        open={cashOpen}
        onClose={() => setCashOpen(false)}
        userId={userId!}
        cashBalance={cashBalance}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["cash-balance"] });
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  tooltip,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "pos" | "neg";
  tooltip?: string;
}) {
  return (
    <div className="bg-card px-5 py-5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span>{label}</span>
        {tooltip && <MetricTooltip term={label} description={tooltip} />}
      </div>
      <div
        className={cn(
          "mt-2 font-mono text-2xl font-semibold tabular tracking-tight",
          tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-foreground",
        )}
      >
        {value}
      </div>
      {sub && (
        <div
          className={cn(
            "mt-1 text-[11px] tabular",
            tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-muted-foreground",
          )}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

interface Holding {
  ticker: string;
  total_lot: number;
}

function TransactionDialog({
  open,
  side: initialSide,
  onClose,
  holdings,
  userId,
  cashBalance,
  onDone,
}: {
  open: boolean;
  side: "BUY" | "SELL";
  onClose: () => void;
  holdings: Holding[];
  userId: string;
  cashBalance: number;
  onDone: () => void;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">(initialSide);
  const [ticker, setTicker] = useState("");
  const [lot, setLot] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd", { locale: idLocale }));
  const [submitting, setSubmitting] = useState(false);

  if (open && side !== initialSide && ticker === "" && lot === "" && price === "") {
    setSide(initialSide);
  }

  const reset = () => {
    setTicker("");
    setLot("");
    setPrice("");
    setDate(format(new Date(), "yyyy-MM-dd", { locale: idLocale }));
  };

  const close = () => {
    reset();
    onClose();
  };

  const lotN = parseInt(lot) || 0;
  const priceN = parseFloat(price) || 0;
  const notional = lotN * priceN * 100;
  const tickerUpper = ticker.trim().toUpperCase();
  const matchedEmiten = IDX_EMITEN.find((e) => e.code === tickerUpper);
  const ownedLot =
    holdings.find((h) => h.ticker === tickerUpper)?.total_lot ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tk = ticker.trim().toUpperCase();
    if (!tk) {
      toast.error("Ticker wajib diisi");
      return;
    }
    if (!IDX_TICKERS.includes(tk)) {
      toast.error(`Ticker "${tk}" tidak dikenali di master list IDX`);
      return;
    }
    if (!lotN || lotN <= 0) {
      toast.error("Lot harus lebih dari 0");
      return;
    }
    if (!priceN || priceN <= 0) {
      toast.error("Harga tidak valid");
      return;
    }
    const today = format(new Date(), "yyyy-MM-dd", { locale: idLocale });
    if (date > today) {
      toast.error("Tanggal tidak boleh lebih dari hari ini");
      return;
    }
    if (side === "SELL") {
      const cur = holdings.find((h) => h.ticker === tk);
      if (!cur || cur.total_lot < lotN) {
        toast.error(
          `Tidak bisa jual ${lotN} lot — kamu hanya punya ${cur?.total_lot ?? 0} lot ${tk}`,
        );
        return;
      }
    }
    if (side === "BUY" && notional > cashBalance) {
      toast.error(
        `Cash balance tidak cukup. Butuh ${notional.toLocaleString("id-ID")}, saldo ${cashBalance.toLocaleString("id-ID")}`,
      );
      return;
    }
    setSubmitting(true);
    try {
      await submitTransaction({
        data: {
          user_id: userId,
          ticker: tk,
          side,
          lot: lotN,
          price: priceN,
          transacted_at: date,
        },
      });
      toast.success(`${side} ${lotN} lot ${tk} @ ${priceN}`);
      onDone();
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal simpan transaksi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[13px] font-semibold uppercase tracking-[0.14em]">
            New Transaction
          </DialogTitle>
        </DialogHeader>

        {/* BUY/SELL pill toggle */}
        <div className="grid grid-cols-2 overflow-hidden rounded-sm border border-border">
          {(["BUY", "SELL"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                "py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
                side === s
                  ? s === "BUY"
                    ? "bg-pos/15 text-pos"
                    : "bg-neg/15 text-neg"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Field label="Ticker">
            <Input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="BBCA"
              maxLength={10}
              required
              list="idx-tickers-datalist"
              className="h-9 rounded-sm border-border bg-background font-mono text-[13px] tracking-wider"
            />
            <datalist id="idx-tickers-datalist">
              {IDX_EMITEN.slice(0, 200).map((e) => (
                <option key={e.code} value={e.code}>
                  {e.name}
                </option>
              ))}
            </datalist>
            {tickerUpper.length >= 2 && (
              <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                {matchedEmiten ? matchedEmiten.name : "✗ Tidak dikenali"}
                {side === "SELL" && matchedEmiten && (
                  <span className="ml-2 text-foreground/70">· Owned: {ownedLot} lot</span>
                )}
              </p>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lot">
              <Input
                type="number"
                min="1"
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                required
                className="h-9 rounded-sm border-border bg-background font-mono text-[13px] tabular"
              />
            </Field>
            <Field label="Price / share">
              <Input
                type="number"
                min="1"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="h-9 rounded-sm border-border bg-background font-mono text-[13px] tabular"
              />
            </Field>
          </div>
          <Field label="Trade date">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-9 rounded-sm border-border bg-background text-[13px]"
            />
          </Field>

          <div className="flex items-center justify-between rounded-sm border border-dashed border-border px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            <span>Notional</span>
            <span className="font-mono text-[13px] font-semibold tabular text-foreground">
              {fmtIDR(notional)}
            </span>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={close}
              className="h-8 rounded-sm border-border text-[12px] uppercase tracking-[0.12em]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className={cn(
                "h-8 rounded-sm px-4 text-[12px] font-semibold uppercase tracking-[0.12em]",
                side === "BUY"
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              {submitting ? "Saving…" : `Confirm ${side}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function CashDialog({
  open,
  onClose,
  userId,
  cashBalance,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  cashBalance: number;
  onDone: () => void;
}) {
  const [type, setType] = useState<"DEPOSIT" | "WITHDRAW">("DEPOSIT");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd", { locale: idLocale }));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setAmount("");
    setNote("");
    setDate(format(new Date(), "yyyy-MM-dd", { locale: idLocale }));
  };
  const close = () => {
    reset();
    onClose();
  };

  const amtN = parseFloat(amount.replace(/[,.]/g, "")) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amtN <= 0) {
      toast.error("Jumlah harus lebih dari 0");
      return;
    }
    if (type === "WITHDRAW" && amtN > cashBalance) {
      toast.error(`Saldo tidak cukup. Saldo: ${fmtIDR(cashBalance)}`);
      return;
    }
    setSubmitting(true);
    try {
      await adjustCash({
        data: {
          user_id: userId,
          movement_type: type,
          amount: amtN,
          occurred_at: date,
          note: note.trim() || undefined,
        },
      });
      toast.success(`${type === "DEPOSIT" ? "Top up" : "Withdraw"} ${fmtIDR(amtN)} berhasil`);
      onDone();
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[13px] font-semibold uppercase tracking-[0.14em]">
            Cash Movement
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-sm border border-dashed border-border px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Saldo saat ini ·{" "}
          <span className="font-mono text-[13px] font-semibold tabular text-foreground">
            {fmtIDR(cashBalance)}
          </span>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-sm border border-border">
          {(["DEPOSIT", "WITHDRAW"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
                type === t
                  ? t === "DEPOSIT"
                    ? "bg-pos/15 text-pos"
                    : "bg-neg/15 text-neg"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {t === "DEPOSIT" ? "Top Up" : "Withdraw"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Amount (IDR)">
            <Input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="h-9 rounded-sm border-border bg-background font-mono text-[13px] tabular"
            />
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-9 rounded-sm border-border bg-background text-[13px]"
            />
          </Field>
          <Field label="Note (optional)">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={255}
              className="h-9 rounded-sm border-border bg-background text-[13px]"
            />
          </Field>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={close}
              className="h-8 rounded-sm border-border text-[12px] uppercase tracking-[0.12em]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="h-8 rounded-sm bg-foreground px-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-background hover:bg-foreground/90"
            >
              {submitting ? "Saving…" : `Confirm ${type === "DEPOSIT" ? "Top Up" : "Withdraw"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
