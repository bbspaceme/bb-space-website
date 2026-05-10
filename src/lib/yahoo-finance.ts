/**
 * Market Data API utilities
 * Now uses provider abstraction with Sectors API as primary and Yahoo as fallback
 */

import { createMarketDataProvider } from "./market-data-provider";

const provider = createMarketDataProvider();

/**
 * Fetch real-time quotes for multiple symbols (15min delay)
 * @param symbols Array of Yahoo Finance symbols (e.g., ["BBCA.JK", "BBRI.JK"])
 * @returns Map of symbol -> regularMarketPrice
 */
export async function fetchYahooQuotes(symbols: string[]): Promise<Record<string, number>> {
  return provider.fetchQuotes(symbols);
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
  return provider.fetchChart(symbol, fromUnix, toUnix);
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
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=5d&interval=1d`;
  const res = await fetch(url, { headers: YAHOO_HEADERS });
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
