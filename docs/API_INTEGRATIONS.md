# API Integration Specifications

## Stock Price Data (Yahoo Finance) - Primary

**Purpose:** Automated stock price retrieval for all tracked companies (global coverage)

**Library:** `yahoo-finance2` (npm package)

**Rate Limits:** ~2,000 requests/hour (unofficial, be conservative)

**Refresh Frequency:**
- Every 15 minutes during market hours (stock-prices cron)
- Hourly updates with snapshot creation (stock-prices-hourly cron)
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

## Stock Price Data (Finnhub) - Optional Supplement

**Purpose:** Real-time quotes for US stocks (supplement to Yahoo Finance)

**API:** Finnhub.io REST API

**Rate Limits:** 60 API calls/minute (free tier)

**Data Delay:** ~15 minutes on free tier

**Best For:**
- US stocks only (NASDAQ, NYSE, AMEX)
- Real-time news and earnings data
- Intraday candle data (1m, 5m, 15m, etc.)

**Setup:**
1. Sign up at https://finnhub.io/
2. Get free API key
3. Add to environment: `FINNHUB_API_KEY=your_key`

**Note:** For international stocks (Tokyo, Hong Kong, London, etc.), Yahoo Finance is recommended as Finnhub's free tier is US-focused.

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
# Yahoo Finance
# No API key required for yahoo-finance2

# Finnhub (Optional - for US stock real-time quotes)
FINNHUB_API_KEY=             # Free at https://finnhub.io/

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
| Yahoo Finance | ~2,000/hour | ~90/hour (15 companies × 4/hour + hourly updates) |
| Finnhub | 60/min (free) | Optional, US stocks only |
| CoinGecko | 10-50/min | 1/min |
| FX API | 1,500/month | 30/month (1/day) |
| Bitcoin Magazine Pro | 500/day | ~168/day max (7 metrics × 24 hours) |
| Claude | Per pricing | As needed for extractions |
| Telegram | 30 msgs/sec | Low volume |
| Slack | 1 msg/sec | Low volume |

## Cron Job Schedule

| Cron | Frequency | Purpose |
|------|-----------|---------|
| `/api/cron/btc-price` | Every 1 min | Update BTC price |
| `/api/cron/stock-prices` | Every 15 min | Update stock prices |
| `/api/cron/stock-prices-hourly` | Every 1 hour | Update prices + create/update daily snapshots |
| `/api/cron/daily-snapshot` | Midnight UTC | Create final daily snapshot for all companies |
| `/api/cron/fx-rates` | 6am ET daily | Update FX rates |
