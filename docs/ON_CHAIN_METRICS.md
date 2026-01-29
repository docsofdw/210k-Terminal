# On-Chain Metrics

## Overview

The On-Chain Metrics page provides Bitcoin on-chain analytics sourced from Bitcoin Magazine Pro's API. This gives the fund team quick access to key valuation and sentiment indicators for market cycle analysis and tactical decision-making.

**Location:** `/dashboard/on-chain`

**Data Source:** Bitcoin Magazine Pro API (https://api.bitcoinmagazinepro.com)

---

## Features

### Summary Cards (Quick Glance)

Four key metrics displayed at the top for instant assessment:

| Card | Metric | Purpose |
|------|--------|---------|
| Fear & Greed | 0-100 index | Market sentiment snapshot |
| MVRV Z-Score | Valuation ratio | Over/undervaluation status |
| Premium to 200 WMA | % above/below | Distance from long-term support |
| Funding Rate (7D) | Avg funding % | Derivatives sentiment & trend |

### Charts

| Chart | Metric Name | Description | Layout |
|-------|-------------|-------------|--------|
| MVRV Z-Score | `mvrv-zscore` | Market Value to Realized Value - primary valuation metric | 2-col |
| NUPL | `nupl` | Net Unrealized Profit/Loss - market cycle position | 2-col |
| Fear & Greed | `fear-and-greed` | Sentiment index with zone backgrounds | 2-col |
| Funding Rates | `fr-average` | Average perpetual futures funding rates | 2-col |
| 200 Week MA | `200wma-heatmap` | Price vs 200 WMA - long-term support | Full |
| Pi Cycle Top | `pi-cycle-top` | 111 DMA vs 350 DMA×2 - cycle top indicator | Full |
| Volatility | `bitcoin-volatility` | 30-day historical volatility | Full |

### Time Frames

| Option | Days | Use Case |
|--------|------|----------|
| 7D | 7 | Short-term tactical, funding rate trends |
| 30D | 30 | Monthly context |
| 90D | 90 | Default trend view |
| 1Y | 365 | Annual perspective |
| 4Y | 1460 | Full Bitcoin cycle (halving-to-halving) |

---

## Architecture

### File Structure

```
app/(authenticated)/dashboard/on-chain/
├── page.tsx                           # Main page (server component)
└── _components/
    ├── date-range-selector.tsx        # Time frame buttons
    ├── summary-cards.tsx              # Quick glance metrics
    ├── mvrv-zscore-chart.tsx          # MVRV Z-Score chart
    ├── nupl-chart.tsx                 # NUPL chart
    ├── fear-greed-chart.tsx           # Fear & Greed chart
    ├── funding-rates-chart.tsx        # Funding rates chart
    ├── heatmap-200wma-chart.tsx       # 200 WMA chart
    ├── pi-cycle-chart.tsx             # Pi Cycle Top chart
    └── volatility-chart.tsx           # Volatility chart

lib/api/
└── bitcoin-magazine-pro.ts            # API client

actions/
└── on-chain-metrics.ts                # Server actions
```

### Data Flow

1. User visits `/dashboard/on-chain` with optional `?days=` param
2. Server component fetches all 7 metrics in parallel via server actions
3. Server actions call the API library functions
4. API library fetches from Bitcoin Magazine Pro with Bearer auth
5. CSV response is parsed to JSON array
6. Data passed to client chart components for rendering

### API Integration

**Base URL:** `https://api.bitcoinmagazinepro.com/metrics`

**Authentication:** Bearer token via `Authorization` header

**Request Format:**
```
GET /metrics/{metric_name}?from_date={YYYY-MM-DD}&to_date={YYYY-MM-DD}
Authorization: Bearer {BITCOIN_MAGAZINE_PRO_API_KEY}
```

**Response Format:** JSON-encoded CSV string

**Caching:** Next.js ISR with 1-hour revalidation (`next: { revalidate: 3600 }`)

---

## Metric Interpretations

### MVRV Z-Score

Measures market value relative to realized value (cost basis of all coins).

| Z-Score | Interpretation | Color |
|---------|---------------|-------|
| ≥ 7 | Extreme Overvalued (sell zone) | Red |
| 5-7 | Overvalued | Orange |
| 3-5 | Fairly Valued (high) | Yellow |
| 0-3 | Fairly Valued | Green |
| < 0 | Undervalued (accumulation zone) | Green |

### NUPL (Net Unrealized Profit/Loss)

Shows aggregate profit/loss of all holders.

| NUPL | Phase | Color |
|------|-------|-------|
| ≥ 0.75 | Euphoria/Greed (distribution) | Red |
| 0.5-0.75 | Belief/Denial | Orange |
| 0.25-0.5 | Optimism/Anxiety | Yellow |
| 0-0.25 | Hope/Fear | Green |
| < 0 | Capitulation (accumulation) | Green |

### Fear & Greed Index

Composite sentiment indicator.

| Value | Sentiment | Color |
|-------|-----------|-------|
| 80-100 | Extreme Greed | Green |
| 60-80 | Greed | Lime |
| 40-60 | Neutral | Yellow |
| 20-40 | Fear | Orange |
| 0-20 | Extreme Fear | Red |

**Note:** Extreme fear often presents buying opportunities; extreme greed suggests caution.

### Funding Rates

Average perpetual futures funding across major exchanges.

| Rate | Interpretation |
|------|---------------|
| > 0.01% | Bullish bias, longs paying shorts |
| 0 to 0.01% | Neutral to slightly bullish |
| < 0 | Bearish bias, shorts paying longs |

Sustained high positive funding can indicate overleveraged longs (potential correction). Negative funding during uptrends can signal continuation.

### 200 Week Moving Average

Long-term support level. Bitcoin has historically never closed below its 200 WMA.

| Premium | Interpretation |
|---------|---------------|
| > 100% | Extended above support |
| 50-100% | Healthy bull market |
| 0-50% | Closer to support |
| < 0% | Extremely rare (max buying opportunity) |

### Pi Cycle Top Indicator

When 111 DMA crosses above (350 DMA × 2), it has historically signaled cycle tops.

**Current Status:** Monitor the gap between the lines. Convergence = potential top.

### Volatility

30-day annualized volatility of daily returns.

| Volatility | Interpretation |
|------------|---------------|
| > 80% | High volatility (typical of bull peaks) |
| 40-80% | Moderate |
| < 40% | Low volatility (potential breakout coming) |

---

## Environment Variables

```bash
# Bitcoin Magazine Pro API
BITCOIN_MAGAZINE_PRO_API_KEY=your_api_key_here
```

**API Key Location:** Bitcoin Magazine Pro account dashboard

**Rate Limits:** 500 requests/day (per API documentation)

**Our Usage:** ~7 requests per page load × hourly cache = ~168/day max

---

## Available Metrics from API

Beyond the 7 we currently use, Bitcoin Magazine Pro offers:

### Market Cycle
- `investor-tool` - 2-Year MA Multiplier
- `stock-to-flow` - Stock-to-Flow Model
- `golden-ratio` - Golden Ratio Multiplier
- `profitable-days` - Bitcoin Profitable Days
- `rainbow-indicator` - Rainbow Price Chart
- `power-law` - Power Law

### On-Chain Indicators
- `reserve-risk` - Reserve Risk
- `sopr` - Spent Output Profit Ratio
- `rhodl-ratio` - RHODL Ratio
- `advanced-nvt-signal` - Advanced NVT Signal
- `realized-price` - Realized Price
- `terminal-price` - Terminal Price
- `balanced-price` - Balanced Price

### Mining
- `puell-multiple` - Puell Multiple
- `hashrate-ribbons` - Hash Ribbons
- `hashprice` - Hashprice

### Macro
- `m2-global-vs-btc` - Global M2 vs BTC
- `fed-balance-sheet` - Fed Balance Sheet vs BTC

See full list: https://api.bitcoinmagazinepro.com/metrics

---

## Adding New Metrics

### 1. Add to API Library

```typescript
// lib/api/bitcoin-magazine-pro.ts
export async function getNewMetric(days: number = 90) {
  return fetchOnChainMetric("metric-name", days)
}
```

### 2. Add Server Action

```typescript
// actions/on-chain-metrics.ts
import { getNewMetric as fetchNewMetric } from "@/lib/api/bitcoin-magazine-pro"

export async function getNewMetric(days: number = 90) {
  return fetchNewMetric(days)
}
```

### 3. Create Chart Component

```typescript
// app/(authenticated)/dashboard/on-chain/_components/new-metric-chart.tsx
"use client"
import type { OnChainMetricDataPoint } from "@/lib/api/bitcoin-magazine-pro"
// ... implement chart using Recharts
```

### 4. Add to Page

```typescript
// app/(authenticated)/dashboard/on-chain/page.tsx
import { getNewMetric } from "@/actions/on-chain-metrics"
import { NewMetricChart } from "./_components/new-metric-chart"

// Add to Promise.all
const [/* existing */, newMetricData] = await Promise.all([
  /* existing */,
  getNewMetric(days)
])

// Add to JSX
<Card>
  <CardHeader>...</CardHeader>
  <CardContent>
    <NewMetricChart data={newMetricData} />
  </CardContent>
</Card>
```

---

## Troubleshooting

### API Returns 404

Check that the metric name matches exactly what's listed at:
```
https://api.bitcoinmagazinepro.com/metrics
```

### Empty Data

1. Verify `BITCOIN_MAGAZINE_PRO_API_KEY` is set in `.env.local`
2. Check API quota hasn't been exceeded (500/day)
3. Ensure date range has data (some metrics don't have historical data)

### Cache Issues

Force refresh by:
1. Restarting dev server
2. In production: Redeploy or wait for 1-hour revalidation

---

## Changelog

**2026-01-29:** Initial implementation
- Added 7 on-chain metrics from Bitcoin Magazine Pro
- Summary cards for quick glance
- Time frames: 7D, 30D, 90D, 1Y, 4Y
- 2-column layout for sentiment metrics
- Colored zone backgrounds for MVRV, NUPL, Fear & Greed
