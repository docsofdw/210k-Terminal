# API Integration Specifications

## Stock Price Data - Provider Routing

As of January 2026, stock price data uses a multi-provider strategy:

| Provider | Coverage | Use Case |
|----------|----------|----------|
| MarketData.app | US stocks | Primary for NYSE, NASDAQ, AMEX |
| Yahoo Finance | International | .T, .HK, .L, .V, .AX, .SA, etc. |
| Twelve Data | Fundamentals | Balance sheet data (cash, debt, shares) |

### Provider Selection Logic

```typescript
function getProvider(ticker: string): "marketdata" | "yahoo" {
  const INTERNATIONAL_SUFFIXES = [
    ".T", ".HK", ".L", ".V", ".AX", ".SA", ".BK", ".KQ",
    ".PA", ".HM", ".MC", ".ST", ".AQ", ".F"
  ]

  for (const suffix of INTERNATIONAL_SUFFIXES) {
    if (ticker.toUpperCase().endsWith(suffix)) {
      return "yahoo"  // International stocks
    }
  }
  return "marketdata"  // US stocks
}
```

---

## MarketData.app (US Stocks) - Primary

**Purpose:** Real-time quotes for US-listed stocks

**API:** `https://api.marketdata.app/v1`

**Plan:** Trader (~$30/month)

**Rate Limits:** 100 requests/minute

**Refresh Frequency:**
- Every 15 minutes via sync-market-data cron

**Endpoints Used:**
| Endpoint | Purpose |
|----------|---------|
| `/v1/stocks/quotes/{symbols}` | Batch quotes (price, change, volume) |

**Environment Variable:** `MARKETDATA_API_KEY`

---

## Stock Price Data (Yahoo Finance) - International

**Purpose:** Automated stock price retrieval for international companies

**Library:** `yahoo-finance2` (npm package)

**Rate Limits:** ~2,000 requests/hour (unofficial, be conservative)

**Refresh Frequency:**
- Every 15 minutes via sync-market-data cron
- Daily snapshot at midnight UTC (daily-snapshot cron)

**Historical Data Backfill:**
```bash
# Backfill all data (FX, BTC, stocks) - 1 year default
npm run db:backfill

# Or run individually:
npm run db:backfill:fx      # FX rates first
npm run db:backfill:btc     # BTC prices second
npm run db:backfill:stocks  # Stock prices last (depends on above)

# Specify days:
npm run db:backfill -- --days=365
```

### Ticker Mapping

| Company | Yahoo Ticker | Notes |
|---------|--------------|-------|
| American Bitcoin Corp. | ABTC | NASDAQ |
| Bitcoin Treasury Corp. | BTCT.V | TSX Venture |
| Oranje S.A. | OBTC3.SA | B3 Brazil |
| DigitalX Limited | DCC.AX | ASX |
| Aifinyo AG | EBEN.HM | Hamburg (may need Frankfurt: AIYN.F) |
| Metaplanet Inc. | 3350.T | Tokyo |
| Matador Technologies | MATA.V | CSE via TSX-V |
| Moon Inc | 1723.HK | HKEX |
| DV8 Public Company | DV8.BK | SET Thailand |
| Smarter Web Company | SWC.AQ | Aquis (may need LSE ticker) |
| Capital B | ALCPB.PA | Euronext Paris |
| Satsuma Technology | SATS.L | LSE (price in pence, divide by 100) |
| Bitplanet Inc. | 049470.KQ | KOSDAQ |
| LQWD Technologies | LQWD.V | TSX Venture |
| Treasury BV | N/A | Private - manual entry only |

### Implementation Notes

- Handle market closures gracefully (use last available price)
- LSE prices are in pence - divide by 100 for GBP
- Implement retry logic with exponential backoff

---

## Twelve Data (Fundamentals)

**Purpose:** Balance sheet data (cash, debt, diluted shares) for all companies

**API:** `https://api.twelvedata.com`

**Plan:** Pro (~$79/month)

**Rate Limits:** 8 requests/minute for balance_sheet endpoint

**Refresh Frequency:**
- Daily at 6am UTC via sync-fundamentals cron
- Only updates companies with stale data (>7 days old)

**Endpoints Used:**
| Endpoint | Purpose | Credits |
|----------|---------|---------|
| `/balance_sheet` | Cash, debt, shares outstanding | 100/symbol |

**Environment Variable:** `TWELVE_DATA_API_KEY`

---

## Finnhub (Deprecated)

**Status:** No longer used. Replaced by MarketData.app for US stocks.

**Note:** Was previously used as optional supplement for US stock real-time quotes.

---

## Bitcoin Price (CoinGecko)

**Purpose:** Real-time BTC/USD price

**Endpoint:**
```
https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
```

**Rate Limits:** 10-50 calls/minute (free tier)

**Refresh:** Every 1 minute

**Fallback:** Binance API if CoinGecko is unavailable

---

## FX Rates

**Purpose:** Daily currency conversion rates

**Options:**
- exchangerate-api.com (free tier: 1,500/month)
- Open Exchange Rates

**Refresh:** Once daily at 6am ET

**Required Pairs:** USD to:
- CAD (Canadian Dollar)
- JPY (Japanese Yen)
- HKD (Hong Kong Dollar)
- GBP (British Pound)
- EUR (Euro)
- AUD (Australian Dollar)
- BRL (Brazilian Real)
- THB (Thai Baht)
- KRW (South Korean Won)

---

## Claude API (AI Extraction)

**Purpose:** Extract BTC holdings from IR pages and Twitter announcements

**Model:** `claude-sonnet-4-20250514` (cost-effective for extraction)

**Use Cases:**
- Parse IR page HTML to find BTC holdings announcements
- Extract structured data from press releases
- Monitor Twitter feeds for purchase announcements

**Important:** All AI extractions require human approval before updating production data.

---

## Bitcoin Magazine Pro API

**Purpose:** On-chain metrics and market cycle indicators

**API Base:** `https://api.bitcoinmagazinepro.com/metrics`

**Authentication:** Bearer token via `Authorization` header

**Rate Limits:** 500 requests/day

**Refresh Frequency:** Every 1 hour (Next.js ISR cache)

**Metrics Used:**
| Metric | Endpoint | Update Frequency |
|--------|----------|------------------|
| MVRV Z-Score | `mvrv-zscore` | Daily |
| NUPL | `nupl` | Daily |
| Fear & Greed | `fear-and-greed` | Daily |
| Funding Rates | `fr-average` | Daily (hourly available) |
| 200 Week MA | `200wma-heatmap` | Daily (hourly available) |
| Pi Cycle Top | `pi-cycle-top` | Daily (hourly available) |
| Volatility | `bitcoin-volatility` | Daily |

**Documentation:** See [ON_CHAIN_METRICS.md](./ON_CHAIN_METRICS.md) for detailed setup and interpretation guide.

---

## BitcoinTreasuries.net

**Purpose:** Reference data for BTC holdings verification

**Integration:** Embed iframe for reference, scrape for cross-verification

```html
<iframe src="https://bitcointreasuries.net/embed?component=entities-table&group=public-companies" />
```

**Note:** No official API. Use as supplementary data source only.

---

## Telegram Bot API

**Purpose:** Send alerts to power users with quick-action links

**Setup:**
1. Create bot via @BotFather
2. Store token in environment variables

**Features:**
- Send formatted alert messages
- Include deep links to admin dashboard for approval
- Support inline buttons for quick acknowledge

---

## Slack Webhooks

**Purpose:** Send alerts and summaries to team channel

**Setup:** Create incoming webhook in Slack workspace

**Features:**
- Rich message formatting
- No interactive features required

---

## Environment Variables

```bash
# MarketData.app (US Stocks)
MARKETDATA_API_KEY=          # From MarketData.app Trader plan

# Twelve Data (Fundamentals)
TWELVE_DATA_API_KEY=         # From Twelve Data Pro plan

# Yahoo Finance
# No API key required for yahoo-finance2

# CoinGecko
COINGECKO_API_KEY=           # Optional, for higher rate limits

# FX Rates
FX_API_KEY=                  # exchangerate-api.com or Open Exchange Rates

# Claude AI
ANTHROPIC_API_KEY=           # For AI extraction features

# Telegram
TELEGRAM_BOT_TOKEN=          # From @BotFather
TELEGRAM_CHAT_ID_PRIMARY=    # Primary user chat ID
TELEGRAM_CHAT_ID_NAMCIOS=    # Namcios chat ID

# Slack
SLACK_WEBHOOK_URL=           # Incoming webhook URL

# Bitcoin Magazine Pro
BITCOIN_MAGAZINE_PRO_API_KEY= # On-chain metrics API
```

---

## Rate Limit Summary

| API | Rate Limit | Our Usage |
|-----|------------|-----------|
| MarketData.app | 100/min | ~70 US stocks every 15 min |
| Yahoo Finance | ~2,000/hour | ~37 international stocks every 15 min |
| Twelve Data | 8/min (balance_sheet) | ~50 companies daily |
| CoinGecko | 10-50/min | 1/min |
| FX API | 1,500/month | 30/month (1/day) |
| Bitcoin Magazine Pro | 500/day | ~168/day max (7 metrics × 24 hours) |
| Claude | Per pricing | As needed for extractions |
| Telegram | 30 msgs/sec | Low volume |
| Slack | 1 msg/sec | Low volume |

## Cron Job Schedule

### Market Data (APIs - Primary)

| Cron | Frequency | Provider | Purpose |
|------|-----------|----------|---------|
| `/api/cron/btc-price` | Every 5 min | CoinGecko | Update BTC price |
| `/api/cron/sync-market-data` | Every 15 min | MarketData.app + Yahoo | Stock prices (with Sheets fallback) |
| `/api/cron/sync-fundamentals` | Daily 6am UTC | Twelve Data | Balance sheet data (cash, debt, shares) |
| `/api/cron/stock-prices` | Every 15 min (weekdays) | Yahoo Finance | Legacy stock price updates |
| `/api/cron/daily-snapshot` | Midnight UTC | Calculated | Create daily snapshot with D.mNAV |
| `/api/cron/fx-rates` | Every 4 hours | Exchange Rate API | FX rates |

### Portfolio & Fund Data (Google Sheets - Primary)

| Cron | Frequency | Sheet | Purpose |
|------|-----------|-------|---------|
| `/api/cron/sync-portfolio` | Every 4 hours | Live Portfolio | Fund positions (qty, value, weight) |
| `/api/cron/sync-fund-performance` | 1st & 15th | Fund Performance | Monthly returns |
| `/api/cron/sync-live-fund-stats` | Every 4 hours | Fund Stats | Live NAV |

### Fallback (Google Sheets - Backup)

| Cron | Status | Purpose |
|------|--------|---------|
| `/api/cron/sync-sheets` | **Not scheduled** (manual only) | Full company data sync - used as fallback when APIs fail |

**Note:** The `sync-market-data` cron automatically falls back to Google Sheets for any company where the API fails. This provides seamless backup without manual intervention.
