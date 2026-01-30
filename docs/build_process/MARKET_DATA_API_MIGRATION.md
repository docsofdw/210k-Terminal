# Market Data API Migration Plan

> **Status:** ✅ COMPLETED (January 30, 2026)

> **Goal:** Replace Google Sheets dependency for market data with direct API integrations (MarketData.app + Twelve Data) while keeping BTC holdings as the only manual entry field.

---

## Completion Summary

**Completed January 30, 2026**

### What Was Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| MarketData.app client | ✅ | `lib/api/marketdata.ts` - US stocks |
| Twelve Data client | ✅ | `lib/api/twelve-data.ts` - Fundamentals |
| Yahoo Finance routing | ✅ | International stocks (.T, .HK, .L, etc.) |
| Market Data Service | ✅ | `lib/services/market-data-service.ts` |
| Calculation Service | ✅ | `lib/services/calculation-service.ts` |
| sync-market-data cron | ✅ | Every 15 min |
| sync-fundamentals cron | ✅ | Daily 6am UTC |
| daily-snapshot fix | ✅ | Uses diluted mNAV |
| Historical backfill | ✅ | 520 snapshots corrected |
| UI labeling | ✅ | "D.mNAV" throughout |

### Key Changes from Original Plan

1. **Yahoo Finance for International Stocks:** Twelve Data doesn't support Yahoo-style ticker suffixes (.T, .HK, etc.), so international stocks route to Yahoo Finance instead.

2. **Diluted mNAV Fix:** Discovered that daily snapshots were using basic mNAV instead of diluted. This caused Value Screener to show incorrect values (e.g., XXI: 0.02x instead of 1.50x). Fixed and backfilled historical data.

3. **Provider Routing:** Three-provider strategy instead of two:
   - MarketData.app → US stocks
   - Yahoo Finance → International stocks
   - Twelve Data → Balance sheet fundamentals only

---

## Table of Contents

1. [Overview](#overview)
2. [Current vs Target Architecture](#current-vs-target-architecture)
3. [API Selection & Coverage](#api-selection--coverage)
4. [Phase 1: API Integrations](#phase-1-api-integrations)
5. [Phase 2: Database Schema Updates](#phase-2-database-schema-updates)
6. [Phase 3: Sync Engine](#phase-3-sync-engine)
7. [Phase 4: Calculation Engine](#phase-4-calculation-engine)
8. [Phase 5: Admin UI for BTC Holdings](#phase-5-admin-ui-for-btc-holdings)
9. [Phase 6: Value Screener Updates](#phase-6-value-screener-updates)
10. [Phase 7: Migration & Cutover](#phase-7-migration--cutover)
11. [Cost Analysis](#cost-analysis)
12. [Testing Strategy](#testing-strategy)
13. [Rollback Plan](#rollback-plan)

---

## Overview

### Problem Statement

Currently, the comps table and value screener rely on a Google Sheet (BTCTCs Master) that:
- Requires manual data entry and formula maintenance
- Syncs every 4 hours (stale data)
- Has no real-time price updates
- Is a single point of failure
- Limits scalability to 107 companies

### Solution

Replace Google Sheets with direct market data API integrations:
- **MarketData.app** (~$30/mo) - US stocks (real-time quotes, fundamentals)
- **Twelve Data** (~$79/mo) - International stocks + fundamentals (balance sheet, cash, debt)
- **CoinGecko** (existing) - BTC price
- **Manual entry** - BTC holdings only (via admin UI)

### What Gets Automated

| Data Field | Current Source | New Source | Update Frequency |
|------------|----------------|------------|------------------|
| Stock price | Google Sheet | MarketData / Twelve Data | 15 min |
| 1D/5D/1M/YTD/1Y % | Google Sheet | MarketData / Twelve Data | 15 min |
| Market cap | Google Sheet | MarketData / Twelve Data | 15 min |
| Shares outstanding | Google Sheet | MarketData / Twelve Data | Daily |
| Diluted shares | Google Sheet | Twelve Data `/balance_sheet` | Quarterly |
| Cash & equivalents | Google Sheet | Twelve Data `/balance_sheet` | Quarterly |
| Total debt | Google Sheet | Twelve Data `/balance_sheet` | Quarterly |
| Volume | Google Sheet | MarketData / Twelve Data | 15 min |
| 52-week high | Google Sheet | MarketData / Twelve Data | Daily |
| 200D avg | Google Sheet | MarketData / Twelve Data | Daily |
| BTC price | CoinGecko | CoinGecko (keep) | 1 min |
| **BTC Holdings** | Google Sheet | **Manual (Admin UI)** | On announcement |

### What Gets Calculated Locally

| Metric | Formula |
|--------|---------|
| BTC NAV | `BTC Holdings × BTC Price` |
| Enterprise Value | `Market Cap + Debt + Preferreds - Cash` |
| Diluted EV | `Diluted Market Cap + Debt + Preferreds - Cash` |
| Basic mNAV | `EV / BTC NAV` |
| Diluted mNAV | `Diluted EV / BTC NAV` |
| 1x D.mNAV Price | `Current Price / Diluted mNAV` |
| Sats per Share | `(BTC Holdings × 100,000,000) / Shares Outstanding` |

---

## Current vs Target Architecture

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Google Sheet (BTCTCs Master)                               │
│  - 107 companies                                            │
│  - All data pre-calculated in formulas                      │
│  - Manual BTC holdings updates                              │
│  - Manual cash/debt updates                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ sync-sheets cron (every 4 hrs)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Companies Table                                            │
│  - Stores all pre-calculated values                         │
│  - No local calculations                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Comps Table + Value Screener                               │
│  - Display only                                             │
└─────────────────────────────────────────────────────────────┘
```

### Target Architecture

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  MarketData.app  │  │   Twelve Data    │  │    CoinGecko     │
│  (US Stocks)     │  │  (International) │  │   (BTC Price)    │
│  ~70 companies   │  │  ~37 companies   │  │                  │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │
         └──────────┬──────────┴──────────┬──────────┘
                    │                     │
                    ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│  sync-market-data cron (every 15 min)                       │
│  - Fetches quotes from both APIs                            │
│  - Routes to correct API based on exchange                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  sync-fundamentals cron (daily)                             │
│  - Fetches balance sheet data (cash, debt, shares)          │
│  - Only for companies with stale fundamental data           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Calculation Engine (lib/calculations.ts)                   │
│  - Computes mNAV, EV, NAV, sats per share                   │
│  - Runs after each data sync                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Companies Table                                            │
│  - Raw API data + calculated metrics                        │
│  - BTC holdings (manual via Admin UI)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│  Comps Table            │  │  Value Screener         │
└─────────────────────────┘  └─────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Admin UI (/dashboard/admin/companies)                      │
│  - Update BTC holdings when companies announce              │
│  - Override cash/debt if needed                             │
│  - Add new companies                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## API Selection & Coverage

### MarketData.app (US Stocks)

**Pricing:** ~$30/month (Trader plan)

**Coverage:** All US exchanges (NYSE, NASDAQ, AMEX)

**Endpoints Used:**

| Endpoint | Data | Rate Limit |
|----------|------|------------|
| `/v1/stocks/quotes/{symbol}` | Price, change, volume, market cap | 100/min |
| `/v1/stocks/candles/{symbol}` | Historical OHLC, 52-week high | 100/min |

**US Companies (~70):**
```
MSTR, MARA, RIOT, COIN, HUT, CLSK, TSLA, XYZ, DJT, ASST,
CEPO, BLSH, CANG, GDC, ABTC, NXTT, NAKA, BTDR, CORZ, IREN,
BITF, CIFR, WULF, MIGI, SMLR, KULR, NVDA (if holding BTC),
... (all US-listed treasury companies)
```

### Twelve Data (International + Fundamentals)

**Pricing:** ~$79/month (Pro plan)

**Coverage:** 50+ global exchanges including:
- Tokyo (TSE) - 3350.T
- Hong Kong (HKEX) - 1723.HK
- London (LSE) - SATS.L
- Toronto (TSX/TSXV) - BTCT.V, LQWD.V, MATA.V
- Germany (XETRA, Frankfurt) - EBEN.HM
- Australia (ASX) - DCC.AX
- Brazil (B3) - OBTC3.SA
- Thailand (SET) - DV8.BK
- Korea (KOSDAQ) - 049470.KQ
- Paris (Euronext) - ALCPB.PA

**Endpoints Used:**

| Endpoint | Data | Credits | Frequency |
|----------|------|---------|-----------|
| `/quote` | Price, change, volume | 1/symbol | Every 15 min |
| `/statistics` | Market cap, shares outstanding | 10/symbol | Daily |
| `/balance_sheet` | Cash, debt, diluted shares | 100/symbol | Weekly |
| `/time_series` | Historical prices, 52-week high | 1/symbol | Daily |

**International Companies (~37):**
```
3350.T (Metaplanet), 1723.HK (Moon Inc), SATS.L (Satsuma),
BTCT.V, LQWD.V, MATA.V (Canadian), DCC.AX (DigitalX),
OBTC3.SA (Oranje), DV8.BK (DV8), 049470.KQ (Bitplanet),
ALCPB.PA (Capital B), EBEN.HM (Aifinyo), ...
```

### Exchange Routing Logic

```typescript
function getApiForTicker(ticker: string): "marketdata" | "twelvedata" {
  // US exchanges -> MarketData.app
  const usExchanges = ["NYSE", "NASDAQ", "AMEX", "NYSEARCA", "BATS"]

  // Check by ticker suffix
  if (ticker.includes(".")) {
    // Has suffix like .T, .HK, .L -> International
    return "twelvedata"
  }

  // Check by exchange field in DB
  const company = await getCompanyByTicker(ticker)
  if (company?.exchange && usExchanges.includes(company.exchange)) {
    return "marketdata"
  }

  // Default to Twelve Data for international
  return "twelvedata"
}
```

---

## Phase 1: API Integrations

### 1.1 MarketData.app Client

**File:** `lib/api/marketdata.ts`

```typescript
// lib/api/marketdata.ts

const MARKETDATA_API_KEY = process.env.MARKETDATA_API_KEY
const BASE_URL = "https://api.marketdata.app/v1"

interface MarketDataQuote {
  symbol: string
  last: number
  change: number
  changepct: number
  volume: number
  updated: number
}

interface MarketDataCandle {
  o: number[]  // open
  h: number[]  // high
  l: number[]  // low
  c: number[]  // close
  v: number[]  // volume
  t: number[]  // timestamp
}

export async function getQuote(symbol: string): Promise<MarketDataQuote | null> {
  const response = await fetch(
    `${BASE_URL}/stocks/quotes/${symbol}/?token=${MARKETDATA_API_KEY}`
  )
  if (!response.ok) return null
  const data = await response.json()
  return data
}

export async function getQuotesBatch(symbols: string[]): Promise<Map<string, MarketDataQuote>> {
  // MarketData.app supports batch requests
  const symbolList = symbols.join(",")
  const response = await fetch(
    `${BASE_URL}/stocks/quotes/${symbolList}/?token=${MARKETDATA_API_KEY}`
  )
  if (!response.ok) return new Map()
  const data = await response.json()
  // Parse and return as Map
  return parseQuotesResponse(data)
}

export async function getCandles(
  symbol: string,
  resolution: "D" | "W" | "M" = "D",
  from?: Date,
  to?: Date
): Promise<MarketDataCandle | null> {
  const params = new URLSearchParams({
    token: MARKETDATA_API_KEY!,
    resolution,
    from: from?.toISOString().split("T")[0] || "",
    to: to?.toISOString().split("T")[0] || ""
  })

  const response = await fetch(
    `${BASE_URL}/stocks/candles/${resolution}/${symbol}/?${params}`
  )
  if (!response.ok) return null
  return response.json()
}

export function isMarketDataConfigured(): boolean {
  return !!MARKETDATA_API_KEY
}
```

### 1.2 Twelve Data Client

**File:** `lib/api/twelve-data.ts`

```typescript
// lib/api/twelve-data.ts

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY
const BASE_URL = "https://api.twelvedata.com"

interface TwelveDataQuote {
  symbol: string
  name: string
  exchange: string
  currency: string
  open: string
  high: string
  low: string
  close: string
  volume: string
  previous_close: string
  change: string
  percent_change: string
  fifty_two_week: {
    low: string
    high: string
  }
}

interface TwelveDataStatistics {
  symbol: string
  market_capitalization: number
  shares_outstanding: number
  // ... other fields
}

interface TwelveDataBalanceSheet {
  symbol: string
  balance_sheet: Array<{
    fiscal_date: string
    cash_and_cash_equivalents: number
    total_debt: number
    common_stock_shares_outstanding: number
    // ... other fields
  }>
}

export async function getQuote(symbol: string): Promise<TwelveDataQuote | null> {
  const response = await fetch(
    `${BASE_URL}/quote?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`
  )
  if (!response.ok) return null
  return response.json()
}

export async function getQuotesBatch(symbols: string[]): Promise<Map<string, TwelveDataQuote>> {
  // Twelve Data supports up to 120 symbols per batch
  const symbolList = symbols.join(",")
  const response = await fetch(
    `${BASE_URL}/quote?symbol=${symbolList}&apikey=${TWELVE_DATA_API_KEY}`
  )
  if (!response.ok) return new Map()
  const data = await response.json()
  return parseQuotesResponse(data)
}

export async function getStatistics(symbol: string): Promise<TwelveDataStatistics | null> {
  const response = await fetch(
    `${BASE_URL}/statistics?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`
  )
  if (!response.ok) return null
  return response.json()
}

export async function getBalanceSheet(symbol: string): Promise<TwelveDataBalanceSheet | null> {
  const response = await fetch(
    `${BASE_URL}/balance_sheet?symbol=${symbol}&period=quarterly&apikey=${TWELVE_DATA_API_KEY}`
  )
  if (!response.ok) return null
  return response.json()
}

export async function getTimeSeries(
  symbol: string,
  interval: "1day" | "1week" | "1month" = "1day",
  outputSize: number = 252 // ~1 year of trading days
): Promise<any> {
  const response = await fetch(
    `${BASE_URL}/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputSize}&apikey=${TWELVE_DATA_API_KEY}`
  )
  if (!response.ok) return null
  return response.json()
}

export function isTwelveDataConfigured(): boolean {
  return !!TWELVE_DATA_API_KEY
}
```

### 1.3 Unified Market Data Service

**File:** `lib/services/market-data-service.ts`

```typescript
// lib/services/market-data-service.ts

import * as marketdata from "@/lib/api/marketdata"
import * as twelvedata from "@/lib/api/twelve-data"
import { db } from "@/db"
import { companies } from "@/db/schema/companies"

// Exchanges that use MarketData.app
const US_EXCHANGES = ["NYSE", "NASDAQ", "AMEX", "NYSEARCA", "BATS", "CBOE"]

interface NormalizedQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  high52Week: number | null
  low52Week: number | null
  marketCap: number | null
  sharesOutstanding: number | null
  currency: string
  exchange: string
  updatedAt: Date
}

export function getApiProvider(ticker: string, exchange?: string): "marketdata" | "twelvedata" {
  // Check for international suffix
  if (ticker.includes(".")) {
    return "twelvedata"
  }

  // Check exchange
  if (exchange && US_EXCHANGES.includes(exchange.toUpperCase())) {
    return "marketdata"
  }

  // Default: assume US if no suffix
  return "marketdata"
}

export async function fetchQuote(
  ticker: string,
  exchange?: string
): Promise<NormalizedQuote | null> {
  const provider = getApiProvider(ticker, exchange)

  if (provider === "marketdata") {
    const quote = await marketdata.getQuote(ticker)
    if (!quote) return null
    return normalizeMarketDataQuote(quote)
  } else {
    const quote = await twelvedata.getQuote(ticker)
    if (!quote) return null
    return normalizeTwelveDataQuote(quote)
  }
}

export async function fetchQuotesBatch(
  tickers: Array<{ ticker: string; exchange?: string }>
): Promise<Map<string, NormalizedQuote>> {
  // Split tickers by provider
  const marketdataTickers: string[] = []
  const twelvedataTickers: string[] = []

  for (const { ticker, exchange } of tickers) {
    const provider = getApiProvider(ticker, exchange)
    if (provider === "marketdata") {
      marketdataTickers.push(ticker)
    } else {
      twelvedataTickers.push(ticker)
    }
  }

  // Fetch in parallel
  const [mdQuotes, tdQuotes] = await Promise.all([
    marketdataTickers.length > 0
      ? marketdata.getQuotesBatch(marketdataTickers)
      : new Map(),
    twelvedataTickers.length > 0
      ? twelvedata.getQuotesBatch(twelvedataTickers)
      : new Map()
  ])

  // Merge and normalize
  const result = new Map<string, NormalizedQuote>()

  for (const [symbol, quote] of mdQuotes) {
    result.set(symbol, normalizeMarketDataQuote(quote))
  }

  for (const [symbol, quote] of tdQuotes) {
    result.set(symbol, normalizeTwelveDataQuote(quote))
  }

  return result
}

function normalizeMarketDataQuote(quote: marketdata.MarketDataQuote): NormalizedQuote {
  return {
    symbol: quote.symbol,
    price: quote.last,
    change: quote.change,
    changePercent: quote.changepct,
    volume: quote.volume,
    high52Week: null, // Fetch separately if needed
    low52Week: null,
    marketCap: null, // MarketData provides this in different endpoint
    sharesOutstanding: null,
    currency: "USD",
    exchange: "US",
    updatedAt: new Date(quote.updated * 1000)
  }
}

function normalizeTwelveDataQuote(quote: twelvedata.TwelveDataQuote): NormalizedQuote {
  return {
    symbol: quote.symbol,
    price: parseFloat(quote.close),
    change: parseFloat(quote.change),
    changePercent: parseFloat(quote.percent_change),
    volume: parseFloat(quote.volume),
    high52Week: parseFloat(quote.fifty_two_week?.high) || null,
    low52Week: parseFloat(quote.fifty_two_week?.low) || null,
    marketCap: null, // Fetch from statistics endpoint
    sharesOutstanding: null,
    currency: quote.currency,
    exchange: quote.exchange,
    updatedAt: new Date()
  }
}
```

---

## Phase 2: Database Schema Updates

### 2.1 Add New Fields to Companies Table

**File:** `db/schema/companies.ts`

Add the following new fields:

```typescript
// Add to existing companies schema

// API data source tracking
dataSource: text("data_source"), // "marketdata" | "twelvedata" | "manual"
lastQuoteAt: timestamp("last_quote_at"),
lastFundamentalsAt: timestamp("last_fundamentals_at"),

// Fields for manual overrides
btcHoldingsManual: decimal("btc_holdings_manual", { precision: 20, scale: 8 }),
btcHoldingsUpdatedAt: timestamp("btc_holdings_updated_at"),
btcHoldingsSource: text("btc_holdings_source"), // "8-K", "Press Release", "Earnings", etc.

// Preferreds (for EV calculation)
preferredsUsd: decimal("preferreds_usd", { precision: 20, scale: 2 }),

// Track if fundamental data is from API or manual
cashSource: text("cash_source"), // "api" | "manual"
debtSource: text("debt_source"), // "api" | "manual"
```

### 2.2 Migration Script

**File:** `db/migrations/add-api-tracking-fields.ts`

```typescript
import { sql } from "drizzle-orm"
import { db } from "@/db"

export async function addApiTrackingFields() {
  await db.execute(sql`
    ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS data_source TEXT,
    ADD COLUMN IF NOT EXISTS last_quote_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_fundamentals_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS btc_holdings_manual DECIMAL(20,8),
    ADD COLUMN IF NOT EXISTS btc_holdings_updated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS btc_holdings_source TEXT,
    ADD COLUMN IF NOT EXISTS preferreds_usd DECIMAL(20,2),
    ADD COLUMN IF NOT EXISTS cash_source TEXT,
    ADD COLUMN IF NOT EXISTS debt_source TEXT
  `)
}
```

---

## Phase 3: Sync Engine

### 3.1 Market Data Sync Cron (Every 15 minutes)

**File:** `app/api/cron/sync-market-data/route.ts`

```typescript
import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import { fetchQuotesBatch } from "@/lib/services/market-data-service"
import { calculateAllMetrics } from "@/lib/services/calculation-service"
import { NextRequest, NextResponse } from "next/server"
import { isNotNull } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get all tracked companies
    const allCompanies = await db
      .select({
        id: companies.id,
        ticker: companies.ticker,
        exchange: companies.exchange,
        btcHoldings: companies.btcHoldings,
        cashUsd: companies.cashUsd,
        debtUsd: companies.debtUsd,
        preferredsUsd: companies.preferredsUsd
      })
      .from(companies)
      .where(isNotNull(companies.ticker))

    // Fetch quotes in batch (split by API provider)
    const tickers = allCompanies.map(c => ({
      ticker: c.ticker!,
      exchange: c.exchange || undefined
    }))

    const quotes = await fetchQuotesBatch(tickers)

    // Get current BTC price
    const btcPrice = await getBtcPrice()

    // Update each company
    let updated = 0
    let errors = 0

    for (const company of allCompanies) {
      const quote = quotes.get(company.ticker!)
      if (!quote) {
        errors++
        continue
      }

      // Calculate metrics
      const metrics = calculateAllMetrics({
        btcHoldings: parseFloat(company.btcHoldings || "0"),
        btcPrice,
        stockPrice: quote.price,
        marketCapUsd: quote.marketCap || (quote.price * parseFloat(company.sharesOutstanding || "0")),
        sharesOutstanding: quote.sharesOutstanding || parseFloat(company.sharesOutstanding || "0"),
        dilutedShares: parseFloat(company.dilutedShares || "0"),
        cashUsd: parseFloat(company.cashUsd || "0"),
        debtUsd: parseFloat(company.debtUsd || "0"),
        preferredsUsd: parseFloat(company.preferredsUsd || "0")
      })

      // Update database
      await db.update(companies)
        .set({
          price: quote.price.toString(),
          priceChange1d: quote.changePercent.toString(),
          marketCapUsd: (quote.marketCap || metrics.marketCapUsd).toString(),
          avgVolumeShares: quote.volume.toString(),
          high1y: quote.high52Week?.toString() || null,

          // Calculated fields
          btcNavUsd: metrics.btcNav.toString(),
          enterpriseValueUsd: metrics.enterpriseValue.toString(),
          basicMNav: metrics.basicMNav.toString(),
          dilutedMNav: metrics.dilutedMNav.toString(),
          priceAt1xDilutedMNav: metrics.priceAt1xDilutedMNav.toString(),
          dilutedEvUsd: metrics.dilutedEv.toString(),

          // Metadata
          lastQuoteAt: new Date(),
          dataSource: quote.exchange.includes("US") ? "marketdata" : "twelvedata",
          updatedAt: new Date()
        })
        .where(eq(companies.id, company.id))

      updated++
    }

    return NextResponse.json({
      success: true,
      updated,
      errors,
      total: allCompanies.length,
      btcPrice,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("Market data sync error:", error)
    return NextResponse.json(
      { error: "Failed to sync market data", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}
```

### 3.2 Fundamentals Sync Cron (Daily)

**File:** `app/api/cron/sync-fundamentals/route.ts`

```typescript
import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import * as twelvedata from "@/lib/api/twelve-data"
import { NextRequest, NextResponse } from "next/server"
import { and, isNotNull, or, isNull, lt } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const maxDuration = 120 // 2 minutes for fundamental data

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get companies that need fundamental updates
    // (no fundamentals OR fundamentals older than 7 days)
    const staleDate = new Date()
    staleDate.setDate(staleDate.getDate() - 7)

    const companiesNeedingUpdate = await db
      .select()
      .from(companies)
      .where(
        and(
          isNotNull(companies.ticker),
          or(
            isNull(companies.lastFundamentalsAt),
            lt(companies.lastFundamentalsAt, staleDate)
          )
        )
      )
      .limit(50) // Process 50 at a time to stay within rate limits

    let updated = 0
    let errors = 0

    for (const company of companiesNeedingUpdate) {
      try {
        // Fetch balance sheet data
        const balanceSheet = await twelvedata.getBalanceSheet(company.ticker!)

        if (balanceSheet?.balance_sheet?.[0]) {
          const latest = balanceSheet.balance_sheet[0]

          await db.update(companies)
            .set({
              // Only update if source is "api" (not manually overridden)
              cashUsd: company.cashSource !== "manual"
                ? latest.cash_and_cash_equivalents?.toString()
                : company.cashUsd,
              debtUsd: company.debtSource !== "manual"
                ? latest.total_debt?.toString()
                : company.debtUsd,
              dilutedShares: latest.common_stock_shares_outstanding?.toString(),

              lastFundamentalsAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(companies.id, company.id))

          updated++
        }

        // Rate limit: 8 requests per minute for balance sheet
        await new Promise(resolve => setTimeout(resolve, 8000))

      } catch (err) {
        console.error(`Error fetching fundamentals for ${company.ticker}:`, err)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      errors,
      processed: companiesNeedingUpdate.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("Fundamentals sync error:", error)
    return NextResponse.json(
      { error: "Failed to sync fundamentals" },
      { status: 500 }
    )
  }
}
```

### 3.3 Vercel Cron Configuration

**File:** `vercel.json` (add new crons)

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-market-data",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/sync-fundamentals",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/btc-price",
      "schedule": "* * * * *"
    }
  ]
}
```

---

## Phase 4: Calculation Engine

### 4.1 Enhanced Calculation Service

**File:** `lib/services/calculation-service.ts`

```typescript
// lib/services/calculation-service.ts

interface CalculationInput {
  btcHoldings: number
  btcPrice: number
  stockPrice: number
  marketCapUsd: number
  sharesOutstanding: number
  dilutedShares: number
  cashUsd: number
  debtUsd: number
  preferredsUsd: number
}

interface CalculatedMetrics {
  // Core metrics
  btcNav: number
  enterpriseValue: number
  dilutedMarketCap: number
  dilutedEv: number
  basicMNav: number
  dilutedMNav: number
  priceAt1xDilutedMNav: number

  // Per share metrics
  btcPerShare: number
  satsPerShare: number
  satsPerDollar: number

  // Ratios
  debtToBtcNav: number
  premiumDiscount: number

  // Convenience
  marketCapUsd: number
}

const SATS_PER_BTC = 100_000_000

export function calculateAllMetrics(input: CalculationInput): CalculatedMetrics {
  const {
    btcHoldings,
    btcPrice,
    stockPrice,
    marketCapUsd,
    sharesOutstanding,
    dilutedShares,
    cashUsd,
    debtUsd,
    preferredsUsd
  } = input

  // BTC NAV = BTC Holdings × BTC Price
  const btcNav = btcHoldings * btcPrice

  // Enterprise Value = Market Cap + Debt + Preferreds - Cash
  const enterpriseValue = marketCapUsd + debtUsd + preferredsUsd - cashUsd

  // Diluted Market Cap = Diluted Shares × Stock Price
  const dilutedMarketCap = dilutedShares * stockPrice

  // Diluted EV = Diluted Market Cap + Debt + Preferreds - Cash
  const dilutedEv = dilutedMarketCap + debtUsd + preferredsUsd - cashUsd

  // Basic mNAV = EV / BTC NAV
  const basicMNav = btcNav > 0 ? enterpriseValue / btcNav : 0

  // Diluted mNAV = Diluted EV / BTC NAV
  const dilutedMNav = btcNav > 0 ? dilutedEv / btcNav : 0

  // 1x Diluted mNAV Price = Current Price / Diluted mNAV
  const priceAt1xDilutedMNav = dilutedMNav > 0 ? stockPrice / dilutedMNav : 0

  // BTC per Share
  const btcPerShare = sharesOutstanding > 0 ? btcHoldings / sharesOutstanding : 0

  // Sats per Share
  const satsPerShare = sharesOutstanding > 0
    ? (btcHoldings * SATS_PER_BTC) / sharesOutstanding
    : 0

  // Sats per Dollar of stock price
  const satsPerDollar = stockPrice > 0 ? satsPerShare / stockPrice : 0

  // Debt to BTC NAV ratio
  const debtToBtcNav = btcNav > 0 ? debtUsd / btcNav : 0

  // Premium/Discount percentage
  const premiumDiscount = (dilutedMNav - 1) * 100

  return {
    btcNav,
    enterpriseValue,
    dilutedMarketCap,
    dilutedEv,
    basicMNav,
    dilutedMNav,
    priceAt1xDilutedMNav,
    btcPerShare,
    satsPerShare,
    satsPerDollar,
    debtToBtcNav,
    premiumDiscount,
    marketCapUsd
  }
}

// Recalculate metrics for a single company
export async function recalculateCompanyMetrics(companyId: string): Promise<void> {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))

  if (!company) return

  const btcPrice = await getBtcPrice()

  const metrics = calculateAllMetrics({
    btcHoldings: parseFloat(company.btcHoldings || "0"),
    btcPrice,
    stockPrice: parseFloat(company.price || "0"),
    marketCapUsd: parseFloat(company.marketCapUsd || "0"),
    sharesOutstanding: parseFloat(company.sharesOutstanding || "0"),
    dilutedShares: parseFloat(company.dilutedShares || "0"),
    cashUsd: parseFloat(company.cashUsd || "0"),
    debtUsd: parseFloat(company.debtUsd || "0"),
    preferredsUsd: parseFloat(company.preferredsUsd || "0")
  })

  await db.update(companies)
    .set({
      btcNavUsd: metrics.btcNav.toString(),
      enterpriseValueUsd: metrics.enterpriseValue.toString(),
      dilutedEvUsd: metrics.dilutedEv.toString(),
      basicMNav: metrics.basicMNav.toString(),
      dilutedMNav: metrics.dilutedMNav.toString(),
      priceAt1xDilutedMNav: metrics.priceAt1xDilutedMNav.toString(),
      dilutedMarketCapUsd: metrics.dilutedMarketCap.toString(),
      updatedAt: new Date()
    })
    .where(eq(companies.id, companyId))
}
```

---

## Phase 5: Admin UI for BTC Holdings

### 5.1 BTC Holdings Update Page

**File:** `app/(authenticated)/dashboard/admin/btc-holdings/page.tsx`

```typescript
// Server component that fetches companies
import { getAllCompanies } from "@/actions/companies"
import { BtcHoldingsTable } from "./_components/btc-holdings-table"

export default async function BtcHoldingsPage() {
  const companies = await getAllCompanies()

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">BTC Holdings Management</h1>
        <p className="text-muted-foreground">
          Update Bitcoin holdings when companies announce purchases or sales.
        </p>
      </div>

      <BtcHoldingsTable companies={companies} />
    </div>
  )
}
```

### 5.2 BTC Holdings Table Component

**File:** `app/(authenticated)/dashboard/admin/btc-holdings/_components/btc-holdings-table.tsx`

```typescript
"use client"

import { useState } from "react"
import { updateBtcHoldings } from "@/actions/companies"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"

interface Company {
  id: string
  ticker: string
  name: string
  btcHoldings: string | null
  btcHoldingsUpdatedAt: Date | null
  btcHoldingsSource: string | null
}

interface Props {
  companies: Company[]
}

export function BtcHoldingsTable({ companies }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newHoldings, setNewHoldings] = useState("")
  const [source, setSource] = useState("Press Release")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleUpdate = async (companyId: string) => {
    setIsSubmitting(true)
    try {
      await updateBtcHoldings({
        companyId,
        btcHoldings: parseFloat(newHoldings),
        source
      })
      setEditingId(null)
      setNewHoldings("")
    } catch (error) {
      console.error("Failed to update:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left">Company</th>
            <th className="px-4 py-3 text-right">BTC Holdings</th>
            <th className="px-4 py-3 text-left">Last Updated</th>
            <th className="px-4 py-3 text-left">Source</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id} className="border-b">
              <td className="px-4 py-3">
                <div className="font-medium">{company.ticker}</div>
                <div className="text-sm text-muted-foreground">{company.name}</div>
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {company.btcHoldings
                  ? parseFloat(company.btcHoldings).toLocaleString()
                  : "—"}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {company.btcHoldingsUpdatedAt
                  ? new Date(company.btcHoldingsUpdatedAt).toLocaleDateString()
                  : "Never"}
              </td>
              <td className="px-4 py-3 text-sm">
                {company.btcHoldingsSource || "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Update
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Update BTC Holdings - {company.ticker}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium">New BTC Holdings</label>
                        <Input
                          type="number"
                          step="0.00000001"
                          placeholder={company.btcHoldings || "0"}
                          value={newHoldings}
                          onChange={(e) => setNewHoldings(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Source</label>
                        <Select value={source} onValueChange={setSource}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="8-K Filing">8-K Filing</SelectItem>
                            <SelectItem value="10-K Filing">10-K Filing</SelectItem>
                            <SelectItem value="10-Q Filing">10-Q Filing</SelectItem>
                            <SelectItem value="Press Release">Press Release</SelectItem>
                            <SelectItem value="Earnings Call">Earnings Call</SelectItem>
                            <SelectItem value="Company Website">Company Website</SelectItem>
                            <SelectItem value="News Article">News Article</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={() => handleUpdate(company.id)}
                        disabled={isSubmitting || !newHoldings}
                        className="w-full"
                      >
                        {isSubmitting ? "Updating..." : "Save Changes"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### 5.3 Server Action for BTC Holdings Update

**File:** `actions/companies.ts` (add new action)

```typescript
"use server"

import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import { eq } from "drizzle-orm"
import { recalculateCompanyMetrics } from "@/lib/services/calculation-service"
import { revalidatePath } from "next/cache"

interface UpdateBtcHoldingsInput {
  companyId: string
  btcHoldings: number
  source: string
}

export async function updateBtcHoldings(input: UpdateBtcHoldingsInput) {
  const { companyId, btcHoldings, source } = input

  // Update BTC holdings
  await db.update(companies)
    .set({
      btcHoldings: btcHoldings.toString(),
      btcHoldingsManual: btcHoldings.toString(),
      btcHoldingsUpdatedAt: new Date(),
      btcHoldingsSource: source,
      updatedAt: new Date()
    })
    .where(eq(companies.id, companyId))

  // Recalculate all metrics for this company
  await recalculateCompanyMetrics(companyId)

  // Revalidate pages
  revalidatePath("/dashboard/comps")
  revalidatePath("/dashboard/charts")
  revalidatePath("/dashboard/admin/btc-holdings")

  return { success: true }
}
```

---

## Phase 6: Value Screener Updates

### 6.1 Update Screener Data Fetching

The value screener currently reads from daily snapshots. We need to ensure snapshots are created from the new API data.

**File:** `app/api/cron/daily-snapshot/route.ts` (update)

```typescript
// Update daily-snapshot cron to use calculated metrics from companies table
// instead of relying on Google Sheets pre-calculated values

export async function GET(request: NextRequest) {
  // ... auth check ...

  // Get all companies with their calculated metrics
  const allCompanies = await db
    .select()
    .from(companies)
    .where(isNotNull(companies.btcHoldings))

  const btcPrice = await getBtcPrice()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  for (const company of allCompanies) {
    // Create daily snapshot with current calculated values
    await db.insert(dailySnapshots).values({
      snapshotDate: today,
      companyId: company.id,
      ticker: company.ticker,
      companyName: company.name,
      stockPrice: company.price,
      stockPriceUsd: company.price, // Convert if needed
      marketCapUsd: company.marketCapUsd,
      btcPrice: btcPrice.toString(),
      btcHoldings: company.btcHoldings,
      btcNav: company.btcNavUsd,
      evUsd: company.enterpriseValueUsd,
      mNav: company.dilutedMNav,
      // ... other fields
      dataSource: "api_calculated"
    }).onConflictDoUpdate({
      target: [dailySnapshots.snapshotDate, dailySnapshots.companyId],
      set: {
        stockPrice: company.price,
        // ... update fields
      }
    })
  }

  return NextResponse.json({ success: true })
}
```

---

## Phase 7: Migration & Cutover

### 7.1 Migration Steps

```
Week 1: Setup & Testing
├── Day 1-2: Set up API accounts (MarketData.app, Twelve Data)
├── Day 3-4: Implement API clients and test with sample tickers
├── Day 5: Deploy API clients to staging

Week 2: Sync Engine
├── Day 1-2: Implement sync-market-data cron
├── Day 3: Implement sync-fundamentals cron
├── Day 4-5: Test syncs in staging, verify data accuracy

Week 3: Calculation & Admin UI
├── Day 1-2: Update calculation service
├── Day 3-4: Build BTC holdings admin UI
├── Day 5: Integration testing

Week 4: Cutover
├── Day 1: Run parallel syncs (Google Sheets + APIs)
├── Day 2: Compare data, identify discrepancies
├── Day 3: Fix discrepancies, tune calculations
├── Day 4: Disable Google Sheets sync, go live with APIs
├── Day 5: Monitor, hotfix if needed
```

### 7.2 Data Validation Queries

```sql
-- Compare Google Sheets data vs API data
SELECT
  c.ticker,
  c.price as api_price,
  gs.price as sheets_price,
  ABS(c.price - gs.price) / gs.price * 100 as price_diff_pct,
  c.diluted_mnav as api_mnav,
  gs.diluted_mnav as sheets_mnav
FROM companies c
JOIN companies_sheets_backup gs ON c.ticker = gs.ticker
WHERE ABS(c.price - gs.price) / gs.price > 0.01  -- >1% difference
ORDER BY price_diff_pct DESC;
```

### 7.3 Rollback Procedure

If issues occur after cutover:

1. Re-enable Google Sheets sync cron
2. Disable API sync crons
3. Run manual sheets sync to restore data
4. Investigate and fix API issues
5. Re-attempt cutover

---

## Cost Analysis

### Monthly Costs

| Service | Plan | Cost | Notes |
|---------|------|------|-------|
| MarketData.app | Trader | $30/mo | US stocks, 100 req/min |
| Twelve Data | Pro | $79/mo | International, fundamentals |
| CoinGecko | Free | $0 | BTC price (existing) |
| **Total** | | **~$109/mo** | |

### API Credit Usage (Twelve Data)

| Endpoint | Credits | Frequency | Monthly Usage |
|----------|---------|-----------|---------------|
| `/quote` (37 intl) | 1 × 37 | 96×/day | ~107,000 |
| `/statistics` (37 intl) | 10 × 37 | 1×/day | ~11,000 |
| `/balance_sheet` (37 intl) | 100 × 37 | 4×/mo | ~15,000 |
| **Total** | | | ~133,000/mo |

Pro plan includes 550,000 credits/month - well within limits.

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/calculations.test.ts
describe("calculateAllMetrics", () => {
  it("calculates mNAV correctly", () => {
    const result = calculateAllMetrics({
      btcHoldings: 1000,
      btcPrice: 100000,
      stockPrice: 150,
      marketCapUsd: 15000000,
      sharesOutstanding: 100000,
      dilutedShares: 120000,
      cashUsd: 1000000,
      debtUsd: 500000,
      preferredsUsd: 0
    })

    // BTC NAV = 1000 × 100000 = 100,000,000
    expect(result.btcNav).toBe(100000000)

    // EV = 15M + 0.5M - 1M = 14.5M
    expect(result.enterpriseValue).toBe(14500000)

    // Basic mNAV = 14.5M / 100M = 0.145
    expect(result.basicMNav).toBeCloseTo(0.145, 3)
  })
})
```

### Integration Tests

```typescript
// __tests__/api-integration.test.ts
describe("Market Data APIs", () => {
  it("fetches US stock quote from MarketData.app", async () => {
    const quote = await marketdata.getQuote("MSTR")
    expect(quote).not.toBeNull()
    expect(quote.symbol).toBe("MSTR")
    expect(quote.last).toBeGreaterThan(0)
  })

  it("fetches international quote from Twelve Data", async () => {
    const quote = await twelvedata.getQuote("3350.T")
    expect(quote).not.toBeNull()
    expect(quote.symbol).toBe("3350.T")
  })
})
```

### E2E Tests

```typescript
// e2e/comps-table.spec.ts
test("comps table displays API data", async ({ page }) => {
  await page.goto("/dashboard/comps")

  // Check MSTR row exists with valid data
  const mstrRow = page.locator("tr", { hasText: "MSTR" })
  await expect(mstrRow).toBeVisible()

  // Price should be a number > 0
  const price = await mstrRow.locator("td:nth-child(4)").textContent()
  expect(parseFloat(price!.replace(/[$,]/g, ""))).toBeGreaterThan(0)
})
```

---

## Rollback Plan

### Immediate Rollback (< 1 hour)

1. Set environment variable: `USE_LEGACY_SHEETS_SYNC=true`
2. The sync-market-data cron checks this flag and skips if true
3. Re-enable sync-sheets cron in Vercel dashboard

### Full Rollback (if APIs have persistent issues)

1. Revert code changes via git
2. Restore companies table from backup
3. Re-deploy with Google Sheets sync
4. Investigate API issues offline

### Backup Strategy

Before cutover:
```bash
# Export current companies data
pg_dump -t companies > companies_backup_$(date +%Y%m%d).sql
```

---

## Environment Variables

Add to `.env.local` and Vercel:

```bash
# MarketData.app
MARKETDATA_API_KEY=your_marketdata_key

# Twelve Data
TWELVE_DATA_API_KEY=your_twelvedata_key

# Feature flag for migration
USE_LEGACY_SHEETS_SYNC=false
```

---

## File Structure (New/Modified)

```
lib/
├── api/
│   ├── marketdata.ts              # NEW: MarketData.app client
│   ├── twelve-data.ts             # NEW: Twelve Data client
│   └── coingecko.ts               # EXISTING: BTC price
├── services/
│   ├── market-data-service.ts     # NEW: Unified market data fetcher
│   └── calculation-service.ts     # NEW: Metrics calculation engine

app/api/cron/
├── sync-market-data/
│   └── route.ts                   # NEW: Quote sync (every 15 min)
├── sync-fundamentals/
│   └── route.ts                   # NEW: Balance sheet sync (daily)
├── sync-sheets/
│   └── route.ts                   # DEPRECATE: Keep for rollback
└── daily-snapshot/
    └── route.ts                   # MODIFY: Use calculated metrics

app/(authenticated)/dashboard/admin/
└── btc-holdings/
    ├── page.tsx                   # NEW: BTC holdings management
    └── _components/
        └── btc-holdings-table.tsx # NEW: Holdings update table

db/
├── schema/
│   └── companies.ts               # MODIFY: Add API tracking fields
└── migrations/
    └── add-api-tracking-fields.ts # NEW: Schema migration

actions/
└── companies.ts                   # MODIFY: Add updateBtcHoldings

__tests__/
├── calculations.test.ts           # NEW: Unit tests
└── api-integration.test.ts        # NEW: API tests
```

---

## Success Criteria

1. **Data Accuracy:** mNAV calculations within 1% of Google Sheets baseline
2. **Freshness:** Stock prices updated every 15 minutes (vs 4 hours)
3. **Reliability:** 99%+ uptime for data syncs
4. **Coverage:** All 107 companies have valid data
5. **Manual Effort:** Only BTC holdings require manual updates

---

## Next Steps

All primary migration tasks are complete. Future enhancements:

1. [x] ~~Sign up for MarketData.app Trader plan~~ ✅
2. [x] ~~Sign up for Twelve Data Pro plan~~ ✅
3. [x] ~~Implement API clients~~ ✅
4. [x] ~~Implement sync crons~~ ✅
5. [x] ~~Fix daily-snapshot to use diluted mNAV~~ ✅
6. [x] ~~Backfill historical snapshots~~ ✅
7. [ ] Optional: Add BTC holdings admin UI (Phase 5)
8. [ ] Optional: Remove legacy Google Sheets sync code
9. [ ] Monitor API rate limits and costs

---

## Related Documentation

- [COMPS_TABLE.md](../COMPS_TABLE.md) - Current comps table implementation
- [CALCULATIONS.md](../CALCULATIONS.md) - Metric formulas
- [API_INTEGRATIONS.md](../API_INTEGRATIONS.md) - Existing API docs
