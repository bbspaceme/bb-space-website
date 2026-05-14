/**
 * Market Data API utilities (Yahoo Finance direct)
 */

const YAHOO_HEADERS: Record<string, string> = {
  Accept: "application/json,text/plain,*/*",
};

function assertYahooFallbackEnabled(): void {
  if (process.env.MARKET_DATA_ALLOW_UNLICENSED_YAHOO !== "true") {
    throw new Error(
      "Yahoo Finance fallback is disabled. Configure a licensed market data provider or set MARKET_DATA_ALLOW_UNLICENSED_YAHOO=true only for local development.",
    );
  }
}

/**
 * Fetch with retry logic and timeout
 * Addresses BE-04: Yahoo Finance reliability
 * - 3 retry attempts with exponential backoff (1s, 2s, 4s)
 * - 15-second timeout per attempt
 * - 429 (rate limit) handled with backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
): Promise<Response> {
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        // Handle rate limiting with backoff
        if (res.status === 429) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue; // Retry
        }

        return res;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Only retry on transient errors, not on abort
      if (err instanceof Error && err.name === "AbortError") {
        lastError = new Error("Yahoo Finance request timeout");
      }

      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError;
}

/**
 * Fetch real-time quotes for multiple symbols (15min delay)
 * @param symbols Array of Yahoo Finance symbols (e.g., ["BBCA.JK", "BBRI.JK"])
 * @returns Map of symbol -> regularMarketPrice
 */
export async function fetchYahooQuotes(symbols: string[]): Promise<Record<string, number>> {
  assertYahooFallbackEnabled();
  if (symbols.length === 0) return {};
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbols.join(","),
  )}`;
  const res = await fetchWithRetry(url, { headers: YAHOO_HEADERS });
  if (!res.ok) throw new Error(`Yahoo quote error: ${res.status}`);
  const json = (await res.json()) as {
    quoteResponse?: { result?: Array<{ symbol: string; regularMarketPrice?: number }> };
  };
  const out: Record<string, number> = {};
  for (const q of json.quoteResponse?.result ?? []) {
    if (typeof q.regularMarketPrice === "number") out[q.symbol] = q.regularMarketPrice;
  }
  return out;
}

/**
 * Fetch historical EOD prices for a symbol
 * @param symbol Yahoo Finance symbol
 * @param fromUnix Start timestamp (seconds since epoch)
 * @param toUnix End timestamp (seconds since epoch)
 * @returns Array of { date: 'YYYY-MM-DD', close: number }
 */
export async function fetchYahooChart(
  symbol: string,
  fromUnix: number,
  toUnix: number,
): Promise<Array<{ date: string; close: number }>> {
  assertYahooFallbackEnabled();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?period1=${fromUnix}&period2=${toUnix}&interval=1d`;
  const res = await fetchWithRetry(url, { headers: YAHOO_HEADERS });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: (number | null)[] }> };
      }>;
    };
  };
  const r = json.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const cl = r?.indicators?.quote?.[0]?.close ?? [];
  const out: Array<{ date: string; close: number }> = [];
  for (let i = 0; i < ts.length; i++) {
    const c = cl[i];
    if (typeof c === "number" && Number.isFinite(c)) {
      out.push({
        date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
        close: c,
      });
    }
  }
  return out;
}

/**
 * Fetch single symbol quote with detail (price, change, currency)
 * Uses chart endpoint for better region compatibility
 * @param symbol Yahoo Finance symbol
 * @returns Object with { price, previousClose, pctChange, currency } or null if error
 */
export async function fetchYahooQuoteDetail(symbol: string): Promise<{
  price: number;
  previousClose: number;
  pctChange: number;
  currency: string;
} | null> {
  assertYahooFallbackEnabled();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=5d&interval=1d`;
  const res = await fetchWithRetry(url, { headers: YAHOO_HEADERS });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          previousClose?: number;
          chartPreviousClose?: number;
          currency?: string;
        };
      }>;
    };
  };
  const m = j.chart?.result?.[0]?.meta;
  if (!m?.regularMarketPrice) return null;
  const prev = m.previousClose ?? m.chartPreviousClose ?? m.regularMarketPrice;
  const pct = prev ? ((m.regularMarketPrice - prev) / prev) * 100 : 0;
  return {
    price: m.regularMarketPrice,
    previousClose: prev,
    pctChange: pct,
    currency: m.currency ?? "USD",
  };
}
