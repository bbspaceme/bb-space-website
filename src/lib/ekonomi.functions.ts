import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callLovableAi } from "@/lib/ai-client";
import { authedMiddleware } from "@/lib/with-auth";
import { fetchYahooQuoteDetail } from "@/lib/yahoo-finance";

// ============== World Bank API ==============
// Indicator examples: NY.GDP.MKTP.KD.ZG (GDP growth), FP.CPI.TOTL.ZG (CPI), SL.UEM.TOTL.ZS (Unemployment)
// Format: https://api.worldbank.org/v2/country/{ISO}/indicator/{INDICATOR}?format=json&per_page=20
async function fetchWorldBank(country: string, indicator: string, perPage = 20) {
  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=${perPage}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`World Bank ${indicator} HTTP ${res.status}`);
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) return [];
  return (json[1] as Array<{ date: string; value: number | null }>)
    .filter((d) => d.value !== null)
    .map((d) => ({ year: Number(d.date), value: Number(d.value) }))
    .sort((a, b) => a.year - b.year);
}

const INDICATORS = {
  GDP_GROWTH: "NY.GDP.MKTP.KD.ZG",
  CPI: "FP.CPI.TOTL.ZG",
  UNEMPLOYMENT: "SL.UEM.TOTL.ZS",
  CURRENT_ACCOUNT: "BN.CAB.XOKA.GD.ZS",
  EXPORTS_USD: "NE.EXP.GNFS.CD",
  IMPORTS_USD: "NE.IMP.GNFS.CD",
  RESERVES: "FI.RES.TOTL.CD",
  GDP_USD: "NY.GDP.MKTP.CD",
} as const;

export const getMacroSnapshot = createServerFn({ method: "GET" })
  .middleware(authedMiddleware)
  .inputValidator((d: { country?: string }) => ({ country: d?.country ?? "IDN" }))
  .handler(async ({ data }) => {
    const c = data.country;
    const safe = async (k: keyof typeof INDICATORS) => {
      try {
        return await fetchWorldBank(c, INDICATORS[k], 30);
      } catch {
        return [];
      }
    };
    const [gdp, cpi, unemp, ca, exp, imp, res, gdpUsd] = await Promise.all([
      safe("GDP_GROWTH"),
      safe("CPI"),
      safe("UNEMPLOYMENT"),
      safe("CURRENT_ACCOUNT"),
      safe("EXPORTS_USD"),
      safe("IMPORTS_USD"),
      safe("RESERVES"),
      safe("GDP_USD"),
    ]);
    return {
      country: c,
      asOf: new Date().toISOString(),
      gdpGrowth: gdp,
      cpi,
      unemployment: unemp,
      currentAccountPctGdp: ca,
      exportsUsd: exp,
      importsUsd: imp,
      reservesUsd: res,
      gdpUsd,
    };
  });

// ============== Commodities (Yahoo Finance proxy) ==============
const COMMODITIES = [
  { symbol: "CL=F", name: "Brent / WTI Crude (USD)" },
  { symbol: "GC=F", name: "Gold (USD/oz)" },
  { symbol: "HG=F", name: "Copper (USD/lb)" },
  { symbol: "NG=F", name: "Natural Gas" },
  { symbol: "MCU=F", name: "Nickel proxy" },
  { symbol: "ZC=F", name: "Corn" },
];

export const getCommodityQuotes = createServerFn({ method: "GET" })
  .middleware(authedMiddleware)
  .handler(async () => {
    const results = await Promise.all(
      COMMODITIES.map(async (c) => {
        const q = await fetchYahooQuoteDetail(c.symbol);
        return {
          ...c,
          ...(q ?? { price: null, previousClose: null, pctChange: null, currency: null }),
        };
      }),
    );
    return { asOf: new Date().toISOString(), items: results };
  });

// ============== FX & Global Rates ==============
const GLOBAL_SYMBOLS = [
  { symbol: "USDIDR=X", name: "USD / IDR" },
  { symbol: "DX-Y.NYB", name: "DXY (Dollar Index)" },
  { symbol: "^TNX", name: "US 10Y Yield" },
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^N225", name: "Nikkei 225" },
  { symbol: "000001.SS", name: "Shanghai Composite" },
  { symbol: "^JKSE", name: "IHSG" },
];

export const getGlobalQuotes = createServerFn({ method: "GET" })
  .middleware(authedMiddleware)
  .handler(async () => {
    const items = await Promise.all(
      GLOBAL_SYMBOLS.map(async (s) => {
        const q = await fetchYahooQuoteDetail(s.symbol);
        return {
          ...s,
          ...(q ?? { price: null, previousClose: null, pctChange: null, currency: null }),
        };
      }),
    );
    return { asOf: new Date().toISOString(), items };
  });

// ============== AI Daily Macro Brief ==============
export const generateMacroBrief = createServerFn({ method: "POST" })
  .middleware(authedMiddleware)
  .inputValidator(
    z.object({
      summary_data: z.string().min(10).max(8000),
    }),
  )
  .handler(async ({ data }) => {
    const j = await callLovableAi<{ choices?: { message?: { content?: string } }[] }>({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Anda adalah Chief Economist KBAI Terminal. Susun briefing makroekonomi Indonesia 1 halaman: kondisi global, dampak ke IDR/IHSG, sektor terpengaruh, dan 3 watchpoint minggu ini. Gunakan bahasa Indonesia, lugas, terstruktur dengan heading. Selalu tutup dengan disclaimer 'Bukan rekomendasi investasi'.",
        },
        { role: "user", content: data.summary_data },
      ],
    });
    return { brief: j.choices?.[0]?.message?.content ?? "" };
  });
