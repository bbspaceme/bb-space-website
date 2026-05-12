interface MarketDataProvider {
  fetchQuotes(symbols: string[]): Promise<Record<string, number>>;
  fetchChart(
    symbol: string,
    fromUnix: number,
    toUnix: number,
  ): Promise<Array<{ date: string; close: number }>>;
}

class YahooFinanceProvider implements MarketDataProvider {
  private headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    Accept: "application/json",
  };

  async fetchQuotes(symbols: string[]): Promise<Record<string, number>> {
    if (symbols.length === 0) return {};
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
      symbols.join(","),
    )}`;
    const res = await fetch(url, { headers: this.headers });
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

  async fetchChart(
    symbol: string,
    fromUnix: number,
    toUnix: number,
  ): Promise<Array<{ date: string; close: number }>> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?period1=${fromUnix}&period2=${toUnix}&interval=1d`;
    const res = await fetch(url, { headers: this.headers });
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
}

class SectorsFinanceProvider implements MarketDataProvider {
  constructor(private apiKey?: string) {}

  async fetchQuotes(symbols: string[]): Promise<Record<string, number>> {
    // Placeholder - implement Sectors API integration
    // This would call Sectors Financial API for IDX data
    console.warn("Sectors API not implemented yet, falling back to Yahoo");
    const yahoo = new YahooFinanceProvider();
    return yahoo.fetchQuotes(symbols);
  }

  async fetchChart(
    symbol: string,
    fromUnix: number,
    toUnix: number,
  ): Promise<Array<{ date: string; close: number }>> {
    // Placeholder - implement Sectors API integration
    console.warn("Sectors API not implemented yet, falling back to Yahoo");
    const yahoo = new YahooFinanceProvider();
    return yahoo.fetchChart(symbol, fromUnix, toUnix);
  }
}

class MarketDataProviderChain implements MarketDataProvider {
  constructor(private providers: MarketDataProvider[]) {}

  async fetchQuotes(symbols: string[]): Promise<Record<string, number>> {
    for (const provider of this.providers) {
      try {
        return await provider.fetchQuotes(symbols);
      } catch (error) {
        console.warn(`Market data provider failed: ${error}`);
        continue;
      }
    }
    throw new Error("All market data providers failed");
  }

  async fetchChart(
    symbol: string,
    fromUnix: number,
    toUnix: number,
  ): Promise<Array<{ date: string; close: number }>> {
    for (const provider of this.providers) {
      try {
        return await provider.fetchChart(symbol, fromUnix, toUnix);
      } catch (error) {
        console.warn(`Market data provider failed: ${error}`);
        continue;
      }
    }
    throw new Error("All market data providers failed");
  }
}

export function createMarketDataProvider(): MarketDataProvider {
  const providers: MarketDataProvider[] = [];

  // Primary: Sectors API (if API key available)
  if (process.env.SECTORS_API_KEY) {
    providers.push(new SectorsFinanceProvider(process.env.SECTORS_API_KEY));
  }

  // Fallback: Yahoo Finance
  providers.push(new YahooFinanceProvider());

  return new MarketDataProviderChain(providers);
}
