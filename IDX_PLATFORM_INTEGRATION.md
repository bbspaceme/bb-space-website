# BB Space × IDX Platform Integration

## Vision: Unified Indonesian Investment Analytics Platform

> **Objective**: Integrate free Indonesian stock market (IDX) data capabilities into BB Space to create a comprehensive, 100% free investment analytics platform.

**Status**: 🚀 Phase 1 — Foundation (In Progress)

---

## 🎯 Strategic Integration

### Current BB Space Capabilities

- ✅ Portfolio management & analysis
- ✅ AI-powered market insights
- ✅ Role-based admin controls
- ✅ Real-time notifications

### New IDX Capabilities

- 📊 Free IDX stock data (Daily OHLCV)
- 💰 Fundamental analysis (PER, PBV, ROE, etc.)
- 📈 Technical indicators (RSI, MACD, BB, SMA)
- 🔍 Multi-sector screener
- 📑 Company profiles & financial statements
- 💵 Dividend tracking
- 🏦 Index performance (COMPOSITE, LQ45, IDX30)

### Architecture Overview

```
BB SPACE (Unified Platform)
├── Portfolio Management (existing)
├── Market Insights (enhanced with IDX)
│   ├── Ekonomi section → IDX indices + macro data
│   ├── Analisis Screener → IDX stock screener
│   └── Market Overview → IDX heatmap & performance
├── Admin Dashboard (existing + IDX management)
└── Community & Research (future)

Data Layer:
├── Supabase PostgreSQL
│   ├── Existing: portfolios, transactions, users
│   └── NEW: IDX data (stocks, prices, ratios, technicals)
├── Scheduled ETL: GitHub Actions (daily 17:10 WIB)
└── API: Vercel Edge Functions (Supabase PostgREST + custom)
```

---

## 📋 Implementation Roadmap

### Phase 1: Foundation (Week 1-2) 🟢 IN PROGRESS

**Goal**: Establish data pipeline and infrastructure

- [ ] **Step 1.1**: Extend Supabase schema with IDX tables
  - `companies` (958 IDX emiten)
  - `stock_prices` (OHLCV historis)
  - `financial_ratios` (PER, PBV, ROE, dll)
  - `technical_indicators` (RSI, MACD, BB, dll)
  - `index_prices` (COMPOSITE, LQ45, IDX30)
  - Plus: companies, dividends, financial_statements

- [ ] **Step 1.2**: Create Python ETL pipeline
  - `scripts/etl/idx_fetch.py` - Fetch dari IDX endpoints
  - `scripts/etl/idx_pipeline.py` - Main orchestrator
  - `scripts/etl/idx_compute_indicators.py` - Indikator teknikal
  - Python requirements: `yfinance, pandas, supabase-py, ta`

- [ ] **Step 1.3**: Setup GitHub Actions scheduler
  - Daily workflow: `.github/workflows/idx-update-daily.yml` (17:10 WIB)
  - Manual workflow: `.github/workflows/idx-initial-load.yml`
  - Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

- [ ] **Step 1.4**: Validate data ingestion
  - Test dengan 10 saham top
  - Verify data quality vs manual checks
  - Monitor 7 hari operasi

### Phase 2: Backend API (Week 3-4) 🟡 PLANNED

**Goal**: Create Vercel Edge Functions for IDX queries

- [ ] **Step 2.1**: Edge Functions
  - `/api/idx/stocks/[ticker]` - Stock detail + chart data
  - `/api/idx/screener` - Multi-filter screener
  - `/api/idx/market/overview` - Market snapshot
  - `/api/idx/indices` - Index performance

- [ ] **Step 2.2**: Caching strategy
  - 15m cache for price data
  - 1h cache for fundamentals
  - 24h cache for company profiles

### Phase 3: Frontend UI (Week 5-8) 🔴 PLANNED

**Goal**: Integrate IDX features into existing UI

- [ ] **Step 3.1**: Enhance existing pages
  - Analisis → Screener: Add IDX filter options
  - Ekonomi → Market: Add IDX indices heatmap
  - Admin → Prices: New IDX data management

- [ ] **Step 3.2**: New components
  - `CandlestickChart` - Using Lightweight Charts
  - `IDXScreener` - Multi-filter table
  - `CompanyProfile` - Detail page
  - `TechnicalAnalysis` - Indicators dashboard

- [ ] **Step 3.3**: Pages
  - `/stocks/[ticker]` - Stock detail page
  - `/idx/screener` - Advanced screener
  - `/idx/markets` - Market overview
  - `/idx/indices` - Index tracking

---

## 📊 Data Sources (Gratis 100%)

| Source                 | Coverage              | Delay         | Limit       | Purpose                         |
| ---------------------- | --------------------- | ------------- | ----------- | ------------------------------- |
| IDX.co.id internal API | All IDX               | Same-day      | None        | Companies, ratios, financials   |
| yfinance               | IDX tickers + indices | 1 hour        | None        | Historical OHLCV, tech analysis |
| Twelve Data (free)     | IDX select            | Real-time     | 800 req/day | Fundamental backup              |
| GitHub Dataset         | 958 emiten            | Weekly update | None        | Historical data 2019+           |

---

## 🔒 Legal Compliance

**IDX Terms of Service Pasal 5**:

- ✅ Personal/Academic use → BOLEH
- ✅ Open source non-commercial → BOLEH (dengan atribusi)
- ❌ Commercial SaaS → PERLU LISENSI (tidak untuk BB Space free tier)
- ❌ Redistribusi tanpa izin → DILARANG

**BB Space Status**: ✅ Compliant (personal/research platform)

---

## 📁 File Structure

```
/workspaces/bb-space-website/
├── scripts/
│   ├── etl/
│   │   ├── idx_fetch.py              # Fetch dari sources
│   │   ├── idx_pipeline.py           # Main orchestrator
│   │   ├── idx_compute_indicators.py # Technical analysis
│   │   └── requirements.txt          # Python deps
│   │
│   └── migrations/
│       └── idx_schema.sql            # Schema untuk IDX
│
├── supabase/
│   └── migrations/
│       └── 000X_idx_tables.sql
│
├── src/
│   ├── routes/
│   │   ├── _app.idx.stocks.[ticker].tsx       # Stock detail
│   │   ├── _app.idx.screener.tsx              # Screener
│   │   └── _app.idx.markets.tsx               # Market overview
│   │
│   ├── components/
│   │   ├── idx/
│   │   │   ├── CandlestickChart.tsx
│   │   │   ├── IDXScreener.tsx
│   │   │   ├── CompanyProfile.tsx
│   │   │   └── TechnicalAnalysis.tsx
│   │   │
│   │   └── (existing components)
│   │
│   ├── lib/
│   │   ├── idx-data.ts               # Supabase queries
│   │   ├── idx-indicators.ts         # Calculations
│   │   └── idx-formatter.ts          # IDR formatting
│   │
│   └── api/
│       └── idx/
│           ├── stocks/[ticker]/route.ts
│           ├── screener/route.ts
│           └── market/overview/route.ts
│
├── .github/
│   └── workflows/
│       ├── idx-update-daily.yml      # Daily 17:10 WIB
│       └── idx-initial-load.yml      # Manual full load
│
└── docs/
    ├── IDX_PLATFORM_INTEGRATION.md   # This file
    └── IDX_SETUP_GUIDE.md            # User guide

```

---

## 🎮 Development Checklist

### Phase 1: Foundation ✅ Current Phase

- [x] Plan integration architecture
- [ ] Add IDX tables to Supabase schema
- [ ] Create Python ETL scripts
- [ ] Setup GitHub Actions workflows
- [ ] Initial data load test
- [ ] Validate data quality

### Phase 2: Backend API 🔄 Next

- [ ] Implement Edge Functions
- [ ] Setup caching headers
- [ ] API testing & validation

### Phase 3: Frontend UI 🔄 Next

- [ ] Add IDX components
- [ ] Enhance existing pages
- [ ] Create new pages
- [ ] Mobile responsive
- [ ] SEO optimization

### Phase 4: Launch & Monitor

- [ ] Full integration testing
- [ ] Performance optimization
- [ ] Documentation & user guide
- [ ] Monitor data pipeline

---

## 📈 Success Metrics

| Metric                    | Target           | Current  |
| ------------------------- | ---------------- | -------- |
| **Audit Score**           | 10/10 ⭐⭐⭐⭐⭐ | 10/10 ✅ |
| **Data Coverage**         | 958 IDX emiten   | TBD      |
| **Data Freshness**        | < 24h            | TBD      |
| **API Response Time**     | < 200ms (edge)   | TBD      |
| **Screener Filters**      | 15+ conditions   | TBD      |
| **Technical Indicators**  | 10+ indicators   | TBD      |
| **Dashboard Performance** | < 3s load        | TBD      |

---

## 🚀 Next Steps

**Immediate** (Next 2 hours):

1. Create Supabase schema migrations for IDX tables
2. Write Python ETL pipeline scripts
3. Setup GitHub Actions workflows

**Follow-up** (Next 24 hours):

1. Test data pipeline end-to-end
2. Load initial historical data
3. Verify data quality

**Week 1**:

1. Validate daily updates working
2. Start Backend API implementation
3. Begin UI component development

---

## 📞 References

- Blueprint: [IDX Platform Blueprint v1.0]
- Data sources: [yfinance](https://github.com/ranaroussi/yfinance), [IDX.co.id](https://www.idx.co.id), [Twelve Data](https://twelvedata.com)
- UI Library: [Lightweight Charts](https://tradingview.github.io/lightweight-charts/)
- DB: [Supabase PostgreSQL](https://supabase.com)
- Deployment: [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)

---

**Last Updated**: May 13, 2026  
**Status**: 🟢 Phase 1 — Foundation  
**Owner**: BB Space Dev Team
