# Comps Table Documentation

Comprehensive documentation for the Treasury Comps table, which displays comparative data for ~100 Bitcoin treasury companies sourced from the BTCTCs Master Google Sheet.

## Overview

The Comps Table (`/dashboard/comps`) is the primary view for analyzing Bitcoin treasury companies. It displays real-time financial metrics synced from an external Google Sheet that aggregates data from multiple sources.

**Key Features:**
- ~100 Bitcoin treasury companies worldwide
- Pre-calculated mNAV, Enterprise Value, and fair value metrics
- Sortable columns with search and filter capabilities
- Category, Region, and Portfolio filters
- **Portfolio Indicator:** Shows which companies are in the 210k Capital portfolio
- **Sync Health Indicator:** Visual indicator of data quality and sync status
- Automatic sync every 4 hours with data protection

---

## Data Source

### Google Sheet Configuration

| Setting | Value |
|---------|-------|
| Spreadsheet ID | `1_whntepzncCFsn-K1oyL5Epqh5D6mauAOnb_Zs7svkk` |
| Sheet Name | `Dashboard` |
| Service Account | `id-10k-terminal-sheet@k-terminal-485321.iam.gserviceaccount.com` |

**Important:** The Google Sheet must be shared with the service account email for syncing to work.

### Sheet Column Mapping

The sync script reads the following columns from the Dashboard sheet:

| Sheet Column | Database Field | Description |
|--------------|----------------|-------------|
| Rank | `rank` | Company ranking by BTC holdings |
| Company Name | `name` | Full company name |
| Ticker | `ticker` | Stock ticker symbol |
| BTC Holdings | `btc_holdings` | Total Bitcoin held |
| Basic mNAV | `basic_mnav` | Market cap / BTC NAV |
| Diluted mNAV | `diluted_mnav` | Diluted market cap / BTC NAV |
| Price | `price` | Current stock price |
| 1D Change | `price_change_1d` | 1-day price change (%) |
| 1x D. mNAV Price | `price_at_1x_diluted_mnav` | Fair value price at 1x diluted mNAV |
| Enterprise Value (USD) | `enterprise_value_usd` | Market Cap + Debt - Cash |
| Avg Volume (USD) | `avg_volume_usd` | Average daily trading volume in USD |
| BTC NAV (USD) | `btc_nav_usd` | BTC Holdings × BTC Price |
| Total Debt | `debt_usd` | Total company debt |
| 1Y High | `high_1y` | 52-week high price |
| 1Y High Delta | `high_1y_delta` | % from 52-week high |
| 200D Avg | `avg_200d` | 200-day moving average |
| 200D Avg Delta | `avg_200d_delta` | % from 200-day average |
| Insider Buy/Sell Ratio | `insider_buy_sell_ratio` | Insider trading ratio |
| Cash and Equiv | `cash_usd` | Cash and equivalents |
| Market Cap | `market_cap_usd` | Current market capitalization |
| Shares Outstanding | `shares_outstanding` | Basic shares outstanding |
| Diluted Shares | `diluted_shares` | Fully diluted share count |
| Diluted Market Cap | `diluted_market_cap_usd` | Diluted shares × price |
| Diluted EV (USD) | `diluted_ev_usd` | Enterprise value (diluted) |
| Exchange | `exchange` | Stock exchange |
| Avg Volume (Shares) | `avg_volume_shares` | Average daily volume (shares) |
| 5D | `price_change_5d` | 5-day price change (%) |
| 1M | `price_change_1m` | 1-month price change (%) |
| YTD | `price_change_ytd` | Year-to-date change (%) |
| 1Y | `price_change_1y` | 1-year price change (%) |
| Currency Code | `currency_code` | Trading currency |
| Conversion Rate | `conversion_rate` | FX rate to USD |
| Region | `region` | Geographic region |
| Sub-Region | `sub_region` | Sub-region classification |
| Category | `category` | Company category (Treasury Company, Miner, Other) |

---

## Database Schema

### Companies Table

The `companies` table stores all synced company data:

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  rank DECIMAL(10,0),
  name TEXT NOT NULL,
  ticker TEXT NOT NULL UNIQUE,
  yahoo_ticker TEXT,
  exchange TEXT,
  currency_code TEXT DEFAULT 'USD',
  conversion_rate DECIMAL(18,8),

  -- Classification
  region TEXT,
  sub_region TEXT,
  category TEXT,

  -- Core Metrics (from Google Sheet)
  btc_holdings DECIMAL(20,8),
  price DECIMAL(20,6),
  price_change_1d DECIMAL(10,4),
  market_cap_usd DECIMAL(20,2),
  shares_outstanding DECIMAL(20,0),
  diluted_shares DECIMAL(20,0),
  diluted_market_cap_usd DECIMAL(20,2),

  -- mNAV Metrics
  basic_mnav DECIMAL(10,4),
  diluted_mnav DECIMAL(10,4),
  price_at_1x_diluted_mnav DECIMAL(20,6),

  -- Valuation
  enterprise_value_usd DECIMAL(20,2),
  diluted_ev_usd DECIMAL(20,2),
  btc_nav_usd DECIMAL(20,2),
  debt_usd DECIMAL(20,2),
  cash_usd DECIMAL(20,2),

  -- Volume
  avg_volume_usd DECIMAL(20,2),
  avg_volume_shares DECIMAL(20,0),

  -- Technicals
  high_1y DECIMAL(20,6),
  high_1y_delta DECIMAL(10,4),
  avg_200d DECIMAL(20,6),
  avg_200d_delta DECIMAL(10,4),

  -- Performance
  price_change_5d DECIMAL(10,4),
  price_change_1m DECIMAL(10,4),
  price_change_ytd DECIMAL(10,4),
  price_change_1y DECIMAL(10,4),

  -- Sync Metadata
  last_synced_at TIMESTAMP,
  sync_source TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Sync Process

### Automatic Sync (Cron Job)

**Endpoint:** `/api/cron/sync-sheets`

**Schedule:** Every 4 hours (`0 */4 * * *`)
- 12:00 AM, 4:00 AM, 8:00 AM, 12:00 PM, 4:00 PM, 8:00 PM UTC

**Behavior:**
- Fetches all rows from the Dashboard sheet
- Upserts companies (updates existing by ticker, inserts new)
- Preserves companies with fund positions (no deletion)
- Updates `last_synced_at` and `sync_source` fields

**Authentication:**
- Requires `Authorization: Bearer {CRON_SECRET}` header
- Uses `GOOGLE_SERVICE_ACCOUNT_KEY` for Google Sheets API

**Manual Trigger:**
```bash
curl -X GET "https://your-domain.vercel.app/api/cron/sync-sheets" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Manual Sync (Seed Script)

For initial data load or full refresh:

```bash
npx tsx db/seed/sync-from-sheets.ts
```

**Behavior:**
- Uses upsert logic (safe to run multiple times)
- Logs each company as it's inserted/updated
- Shows summary of updated vs inserted counts

---

## Data Protection & Sync Health

### Null Value Protection

The sync process includes protection against data loss from temporary Google Sheets issues:

**Problem Solved:**
If the Google Sheet temporarily has missing data (API timeout, formula errors, etc.), the sync would previously write `null` values to the database, overwriting good existing data.

**Solution:**
When updating existing companies, only fields with valid (non-null) values are updated. Existing good data is preserved if the Google Sheet temporarily has missing values.

```typescript
// Only update fields that have valid values
const safeUpdateData = filterNullValues(updateData)
```

### Sync Health Indicator

A visual badge in the page header shows the current data quality status:

| Status | Badge Color | Meaning |
|--------|-------------|---------|
| Healthy | Green | All companies have complete data |
| Degraded | Yellow | 10-30% of companies missing critical fields |
| Issues | Red | >30% of companies missing critical fields |

**Critical Fields Monitored:**
- `price`
- `marketCapUsd`
- `dilutedMNav`
- `enterpriseValueUsd`
- `btcNavUsd`

**Hover Tooltip Shows:**
- Overall sync quality status
- Number of companies with incomplete data
- Last sync timestamp

### Anomaly Detection

During sync, the system:
1. Tracks data quality score for each company
2. Logs warnings when major companies (MSTR, MARA, COIN, RIOT) are missing critical fields
3. Returns sync health metrics in the API response

**API Response Includes:**
```json
{
  "success": true,
  "updated": 100,
  "inserted": 0,
  "syncHealth": {
    "quality": "healthy",
    "qualityScore": 95,
    "lowQualityRows": 5,
    "warnings": ["MARA missing critical fields: price, marketCapUsd"]
  }
}
```

---

## UI Components

### Comps Page (`/dashboard/comps`)

**File:** `app/(authenticated)/dashboard/comps/page.tsx`

**Features:**
- BTC Price header with 24h change, high, low
- Summary cards: Companies tracked, Total BTC holdings, BTC price
- Last sync timestamp display
- Comps table with all companies

### Comps Table Component

**File:** `app/(authenticated)/dashboard/comps/_components/comps-table.tsx`

**Displayed Columns:**

| Column | Field | Description |
|--------|-------|-------------|
| Company | `name`, `category`, `region` | Name with category/region subtitle |
| Ticker | `ticker` | Stock symbol badge |
| BTC | `btc_holdings` | Bitcoin holdings (formatted) |
| Price | `price` | Current stock price |
| 1D | `price_change_1d` | 1-day change (color-coded) |
| Mkt Cap | `market_cap_usd` | Market cap (compact format) |
| D. mNAV | `diluted_mnav` | Diluted mNAV (color-coded) |
| 1x D.mNAV | `price_at_1x_diluted_mnav` | Fair value price (green) |
| EV | `enterprise_value_usd` | Enterprise value |
| BTC NAV | `btc_nav_usd` | BTC holdings value |
| Debt | `debt_usd` | Total debt |
| Shares | `shares_outstanding` | Shares outstanding |
| Dil. Shares | `diluted_shares` | Diluted shares |
| Avg Vol | `avg_volume_usd` | Average volume USD |

**Sorting:**
- All columns are sortable (click header to toggle asc/desc)
- Default sort: by BTC holdings (descending)

**Filtering:**
- Search: Filter by company name or ticker
- Category: Filter by company category (Treasury Company, Miner, Other)
- Region: Filter by geographic region (North America, Asia, Europe, etc.)
- **Portfolio:** Filter to show only companies in the 210k Capital portfolio

**Portfolio Indicator:**
- Companies in the 210k portfolio display an orange briefcase icon next to their name
- Hover over the icon to see "In 210k Portfolio" tooltip
- Use the "210k Portfolio" filter dropdown to view only portfolio companies
- Portfolio data is sourced from the `fund_positions` table (synced from Google Sheets)

**Color Coding:**

*mNAV Colors:*
- Red (>2.0x): Significantly overvalued
- Orange (>1.5x): Moderately overvalued
- Yellow (>1.0x): Slightly overvalued
- Emerald (<1.0x): Undervalued
- Green (<0.8x): Significantly undervalued

*Price Change Colors:*
- Green: Positive change
- Red: Negative change

---

## Key Metrics Explained

### mNAV (Multiple to Net Asset Value)

```
mNAV = Enterprise Value / BTC NAV
     = (Market Cap + Debt + Preferreds - Cash) / (BTC Holdings × BTC Price)
```

**Interpretation:**
- mNAV of 1.0x = Stock trading at fair value to BTC holdings
- mNAV > 1.0x = Premium (paying more than BTC value)
- mNAV < 1.0x = Discount (paying less than BTC value)

### 1x Diluted mNAV Price

The theoretical stock price if the company traded at exactly 1x diluted mNAV (fair value based on BTC holdings).

```
1x D.mNAV Price = Current Price / Diluted mNAV
```

**Use Case:** Identify how much upside/downside exists if stock were to trade at fair value.

### Enterprise Value

```
EV = Market Cap + Total Debt + Preferred Stock - Cash
```

Represents the total value of the company including debt obligations.

---

## Environment Variables

```bash
# Google Sheets API (Required)
GOOGLE_SERVICE_ACCOUNT_KEY='{...}'  # Full JSON service account key

# Cron Authentication
CRON_SECRET=your_secret_here
```

---

## File Structure

```
app/
├── (authenticated)/
│   └── dashboard/
│       └── comps/
│           ├── page.tsx                    # Main comps page (includes sync health)
│           └── _components/
│               ├── comps-table.tsx         # Sortable/filterable table (includes portfolio indicator)
│               └── btc-price-header.tsx    # BTC price display

actions/
└── companies.ts                            # Server actions for companies
    # Key functions:
    # - getAllCompanies()           Get all tracked companies
    # - getSyncHealthStatus()       Check data quality for health indicator
    # - getPortfolioCompanyIds()    Get company IDs in 210k portfolio

db/
├── schema/
│   ├── companies.ts                        # Drizzle schema definition
│   └── fund-positions.ts                   # Portfolio positions schema
└── seed/
    └── sync-from-sheets.ts                 # Manual sync script (with null protection)

lib/
└── api/
    └── google-sheets.ts                    # Google Sheets API client

app/api/cron/
└── sync-sheets/
    └── route.ts                            # Cron job endpoint (with data protection)
```

---

## Troubleshooting

### Sync Not Working

1. **Check Google Sheet permissions:**
   - Ensure sheet is shared with `id-10k-terminal-sheet@k-terminal-485321.iam.gserviceaccount.com`
   - Service account needs at least "Viewer" access

2. **Check environment variables:**
   ```bash
   # Verify GOOGLE_SERVICE_ACCOUNT_KEY is set
   echo $GOOGLE_SERVICE_ACCOUNT_KEY | head -c 50
   ```

3. **Test manually:**
   ```bash
   npx tsx db/seed/sync-from-sheets.ts
   ```

### Companies Not Updating

- Foreign key constraints may prevent deletion if company has fund positions
- The sync uses upsert logic - existing companies are updated, not deleted
- Check `last_synced_at` field to verify sync ran

### Timestamp Not Showing

- Ensure companies have `last_synced_at` populated
- The query filters for companies where `is_tracked = true` AND `last_synced_at IS NOT NULL`

---

## Related Documentation

- [API Integrations](./API_INTEGRATIONS.md) - External API configurations
- [Data Model](./DATA_MODEL.md) - Full database schema
- [Calculations](./CALCULATIONS.md) - mNAV and metric formulas
- [Portfolio Positions](./PORTFOLIO_POSITIONS.md) - Fund position tracking
