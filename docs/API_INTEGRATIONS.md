# API Integration Specifications

## Stock Price Data (Yahoo Finance)

**Purpose:** Automated stock price retrieval for all tracked companies

**Library:** `yahoo-finance2` (npm package)

**Rate Limits:** ~2,000 requests/hour (unofficial, be conservative)

**Refresh Frequency:**
- Every 15 minutes during market hours
- Daily otherwise

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
```

---

## Rate Limit Summary

| API | Rate Limit | Our Usage |
|-----|------------|-----------|
| Yahoo Finance | ~2,000/hour | ~60/hour (15 companies × 4/hour) |
| CoinGecko | 10-50/min | 1/min |
| FX API | 1,500/month | 30/month (1/day) |
| Claude | Per pricing | As needed for extractions |
| Telegram | 30 msgs/sec | Low volume |
| Slack | 1 msg/sec | Low volume |
