# Historical Data & Backfill System

This document describes the historical data infrastructure for stock prices, BTC prices, and FX rates, including backfill scripts for initial data population and cron jobs for ongoing updates.

---

## Overview

The charts and analytics section requires historical data to display trends over time. This data comes from three sources:

| Data Type | Source | Update Frequency | Table |
|-----------|--------|------------------|-------|
| Stock Prices | Yahoo Finance | Every 15 min / hourly | `stock_prices`, `daily_snapshots` |
| BTC Price | CoinGecko | Every 1 min | `btc_prices` |
| FX Rates | Manual / API | Daily | `fx_rates` |

---

## Database Tables

### `stock_prices`
Stores raw stock price data in **local trading currency** (not USD).

```
- id (uuid)
- companyId (uuid, FK)
- price (decimal) - Current price in local currency
- open, high, low, close (decimal) - OHLC data
- volume (decimal)
- marketCapUsd (decimal)
- priceAt (timestamp)
- createdAt (timestamp)
```

### `daily_snapshots`
Stores point-in-time snapshots for each company, used by charts. Contains both local and USD prices.

```
- id (uuid)
- snapshotDate (timestamp) - Normalized to midnight UTC
- companyId (uuid, FK)
- ticker, companyName (text) - Denormalized for historical accuracy
- stockPrice (decimal) - In local currency
- stockPriceUsd (decimal) - Converted to USD
- marketCapUsd, btcPrice, btcHoldings, btcNav (decimal)
- evUsd, mNav, satsPerShare, btcPerShare (decimal)
- fxRate, tradingCurrency (text)
- dataSource (text) - "database", "yahoo_finance_backfill", "hourly_update"
```

### `market_snapshots`
Aggregate market data across all companies for a given date.

```
- snapshotDate (timestamp, unique)
- btcPrice (decimal)
- totalBtcHoldings, totalMarketCapUsd, totalEvUsd, totalBtcNav (decimal)
- avgMNav, medianMNav, weightedAvgMNav (decimal)
- companyCount (decimal)
```

### `btc_prices`
Bitcoin price history from CoinGecko.

```
- priceUsd (decimal)
- high24h, low24h, volume24h, change24h, marketCap (decimal)
- priceAt (timestamp)
```

### `fx_rates`
Currency exchange rates relative to USD.

```
- currency (text) - e.g., "CAD", "JPY", "GBP"
- rateToUsd (decimal) - How many local currency = 1 USD
- rateFromUsd (decimal) - Inverse rate
- rateAt (timestamp)
```

---

## Backfill Scripts

Located in `/db/seed/`, these scripts populate historical data.

### Master Backfill (Recommended)

```bash
# Run all backfills in correct order (1 year default)
npm run db:backfill

# Specify number of days
npm run db:backfill -- --days=365

# Dry run (no database writes)
npm run db:backfill -- --dry-run
```

This runs the following scripts in order:
1. `backfill-fx-rates.ts` - FX rates (required for currency conversion)
2. `backfill-btc-prices.ts` - BTC prices (required for mNAV calculations)
3. `backfill-stock-prices.ts` - Stock prices (depends on above)

### Individual Scripts

```bash
# BTC prices from CoinGecko
npm run db:backfill:btc
npm run db:backfill:btc -- --days=365

# FX rates (uses approximated current rates with variance)
npm run db:backfill:fx
npm run db:backfill:fx -- --days=365

# Stock prices from Yahoo Finance
npm run db:backfill:stocks
npm run db:backfill:stocks -- --days=365
npm run db:backfill:stocks -- --ticker=MSTR  # Single company
```

### Script Details

#### `backfill-btc-prices.ts`
- **Source:** CoinGecko `/coins/bitcoin/market_chart` endpoint
- **Data:** Daily OHLC prices, market cap, volume
- **Rate Limit:** 10-50 calls/minute (free tier)
- **Output:** Populates `btc_prices` table

#### `backfill-fx-rates.ts`
- **Source:** Approximated from current rates with ±2% variance
- **Currencies:** CAD, EUR, GBP, JPY, HKD, AUD, BRL, THB, KRW
- **Note:** For accurate historical FX, consider a paid API
- **Output:** Populates `fx_rates` table

#### `backfill-stock-prices.ts`
- **Source:** Yahoo Finance `historical()` API
- **Dependencies:** Requires BTC prices and FX rates to exist first
- **Processing per day:**
  1. Fetch historical OHLC from Yahoo Finance
  2. Look up BTC price for that date
  3. Look up FX rate for the company's trading currency
  4. Calculate all metrics (mNAV, EV, sats per share, etc.)
  5. Insert into `stock_prices` and `daily_snapshots`
- **Output:** Populates `stock_prices`, `daily_snapshots`, `market_snapshots`

---

## Currency Handling

### Local Currency Storage
All stock prices are stored in their **local trading currency**, not USD:
- Metaplanet (3350.T) → JPY
- Moon Inc (1723.HK) → HKD
- Satsuma (SATS.L) → GBP
- DV8 (DV8.BK) → THB

### LSE Pence Conversion
London Stock Exchange prices from Yahoo Finance are quoted in **pence** (0.01 GBP), not pounds. The system automatically divides by 100 for stocks with `.L` suffix:

```typescript
// lib/utils/currency.ts
function adjustForPence(price: number, yahooTicker: string): number {
  if (yahooTicker.endsWith(".L")) {
    return price / 100
  }
  return price
}
```

### USD Conversion
The `daily_snapshots` table stores both prices:
- `stockPrice` - Local currency (e.g., 1500 JPY)
- `stockPriceUsd` - Converted to USD (e.g., $10.03)

Conversion formula: `stockPriceUsd = stockPrice / fxRate`

Where `fxRate` is how many local currency units equal 1 USD.

---

## Cron Jobs

### Existing Cron Jobs

| Endpoint | Frequency | Purpose |
|----------|-----------|---------|
| `/api/cron/btc-price` | Every 1 min | Update BTC price |
| `/api/cron/stock-prices` | Every 15 min | Update stock prices only |
| `/api/cron/daily-snapshot` | Midnight UTC | Create final daily snapshots |

### New Hourly Cron Job

| Endpoint | Frequency | Purpose |
|----------|-----------|---------|
| `/api/cron/stock-prices-hourly` | Every 1 hour | Update stock prices AND daily snapshots |

The hourly cron job (`/api/cron/stock-prices-hourly/route.ts`) does more than the 15-minute cron:
1. Fetches latest stock quotes from Yahoo Finance
2. Adjusts for LSE pence if needed
3. Inserts into `stock_prices` table
4. **Creates or updates** today's `daily_snapshots` entry

This ensures charts show current data throughout the day, not just at midnight.

### Cron Configuration (Vercel)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/btc-price",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/stock-prices",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/stock-prices-hourly",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/daily-snapshot",
      "schedule": "0 0 * * *"
    }
  ]
}
```

All cron endpoints require authorization: `Bearer {CRON_SECRET}`

---

## Charts Integration

### Data Flow

```
User visits /dashboard/charts?company=3350.T
                ↓
getCompanySnapshotsByTicker("3350.T", days)
                ↓
Reads from daily_snapshots table
                ↓
CompanyPriceChart component receives data
                ↓
User toggles between JPY ↔ USD
                ↓
Chart switches between stockPrice and stockPriceUsd
```

### USD Toggle Feature

The `CompanyPriceChart` component (`app/(authenticated)/dashboard/charts/_components/company-price-chart.tsx`) includes a toggle button:

- **Default:** Shows price in local currency (e.g., JPY, HKD)
- **Toggle to USD:** Shows converted USD price
- **Only appears** when currency is not USD and both prices exist

Currency symbols supported:
- USD ($), CAD (C$), EUR (€), GBP (£), JPY (¥)
- HKD (HK$), AUD (A$), BRL (R$), THB (฿), KRW (₩)

---

## Troubleshooting

### No Historical Data Showing
1. Check if backfill was run: `SELECT COUNT(*) FROM daily_snapshots`
2. Verify BTC prices exist: `SELECT COUNT(*) FROM btc_prices`
3. Verify FX rates exist: `SELECT COUNT(*) FROM fx_rates`
4. Re-run backfill if needed: `npm run db:backfill`

### Missing Data for Specific Company
```bash
# Backfill single company
npm run db:backfill:stocks -- --ticker=MSTR --days=365
```

### Yahoo Finance Deprecation Warning
The warning about `historical()` being deprecated is expected. The library automatically maps to `chart()` internally. No action needed.

### LSE Prices Look Wrong
Verify the pence conversion is applied. LSE stocks (`.L` suffix) should have prices divided by 100. Check:
```sql
SELECT ticker, stockPrice, tradingCurrency
FROM daily_snapshots
WHERE ticker = 'SATS.L'
ORDER BY snapshotDate DESC
LIMIT 5;
```

### Slow Backfill Performance
The backfill is slow because:
1. Individual database inserts (not batched)
2. Each day requires BTC and FX lookups
3. Remote database latency

For faster performance, consider:
- Running during off-peak hours
- Using a local database for testing
- Reducing days to backfill

---

## Optional: Finnhub Integration

For real-time US stock quotes, Finnhub can supplement Yahoo Finance.

### Setup
1. Sign up at https://finnhub.io/
2. Get free API key
3. Add to `.env.local`: `FINNHUB_API_KEY=your_key`

### Usage
```typescript
import { getFinnhubQuote, isFinnhubConfigured } from "@/lib/api/finnhub"

if (isFinnhubConfigured()) {
  const quote = await getFinnhubQuote("AAPL")
}
```

### Limitations
- Free tier: 60 API calls/minute
- ~15 minute delay on free tier
- US stocks only (NASDAQ, NYSE, AMEX)
- For international stocks, use Yahoo Finance

---

## File Reference

| File | Purpose |
|------|---------|
| `db/seed/backfill-all.ts` | Master backfill script |
| `db/seed/backfill-btc-prices.ts` | BTC price backfill |
| `db/seed/backfill-fx-rates.ts` | FX rates backfill |
| `db/seed/backfill-stock-prices.ts` | Stock price backfill |
| `app/api/cron/stock-prices-hourly/route.ts` | Hourly update cron |
| `lib/utils/currency.ts` | Currency utilities (pence conversion, symbols) |
| `lib/api/finnhub.ts` | Optional Finnhub integration |
| `lib/api/yahoo-finance.ts` | Yahoo Finance API wrapper |
| `app/(authenticated)/dashboard/charts/_components/company-price-chart.tsx` | Chart with USD toggle |

---

## Related Documentation

- [API_INTEGRATIONS.md](./API_INTEGRATIONS.md) - External API specifications
- [DATA_MODEL.md](./DATA_MODEL.md) - Complete database schema
- [CALCULATIONS.md](./CALCULATIONS.md) - mNAV and metric formulas
