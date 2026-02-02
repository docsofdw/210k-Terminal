# Fund Performance Analytics

This document describes the fund performance analytics system, including database schema, Google Sheets sync, server actions, and chart components for visualizing 210k Capital fund performance vs Bitcoin benchmark.

---

## Overview

The Fund Performance feature provides analytics for tracking 210k Capital fund performance over time, comparing returns against Bitcoin as a benchmark. Data is sourced from the "210k Portfolio Stats" Google Spreadsheet with two sync mechanisms:

1. **Live Stats Sync** - Every 4 hours for current AUM and MTD return
2. **Historical Sync** - Bi-weekly for monthly historical data

| Component | Description |
|-----------|-------------|
| Data Source | Google Sheets (same spreadsheet as Live Portfolio) |
| Live Sync Frequency | Every 4 hours (`sync-live-fund-stats`) |
| Historical Sync Frequency | Bi-weekly on 1st and 15th (`sync-fund-performance`) |
| Database Tables | `fund_performance_snapshots`, `fund_statistics` |
| Charts | Fund vs BTC (normalized), Monthly Returns (bar chart) |
| Page Location | `/dashboard/fund-performance` (dedicated page under Analytics menu) |

---

## Data Source

### Google Spreadsheet

| Property | Value |
|----------|-------|
| Spreadsheet ID | `1R5ZXjN3gDb7CVTrbUdqQU_HDLM2cFVUGS5CNynslAzE` |
| Spreadsheet Name | 210k Portfolio Stats |
| Authentication | Google Service Account (`GOOGLE_SERVICE_ACCOUNT_KEY`) |

### Sheets Synced

| Sheet Name | Sync Endpoint | Target Table | Data Contents |
|------------|---------------|--------------|---------------|
| Live Portfolio | `sync-live-fund-stats` | `fund_performance_snapshots` | Real-time AUM, MTD return, BTC price |
| Portfolio Statistics | `sync-fund-performance` | `fund_performance_snapshots` | **Primary source** for monthly fund & BTC returns |
| Historical Performance (rows 1-7) | `sync-fund-performance` | `fund_statistics` | Summary stats: Total Return, IRR, BTC Outperformance |
| Historical Performance (row 9+) | `sync-fund-performance` | `fund_performance_snapshots` | Monthly AUM snapshots since 2019 (reference only) |
| Net Returns | `sync-fund-performance` | `fund_performance_snapshots` | Backup monthly fund returns by year |

### Live Portfolio Sheet (Rows 1-4)

The Live Portfolio sheet contains real-time fund data in the first 4 rows:

```
Row 1: ["Live AUM", "$138,921,796", "NAV AUM", "$126,138,563", "", "10.9%", "Fund MTD", ...]
Row 2: ["MTM AUM", "$145,751,261", "NAV AUM", "$126,138,563", "15.5%", ...]
Row 3: ["Live BTC Price", "$87,845", "NAV BTC Price", "$88,264", "-0.5%", ...]
Row 4: ["Bitcoin AUM", "1,581.45", "", "5%"]
```

| Field | Location | Description |
|-------|----------|-------------|
| Live AUM | Row 1, Column B | Current fund AUM in USD |
| Fund MTD | Row 1, Column F | Current month-to-date return (percentage) |
| Live BTC Price | Row 3, Column B | Current BTC price |
| Bitcoin AUM | Row 4, Column B | Total BTC holdings |

### Historical Performance Sheet

The Historical Performance sheet contains monthly snapshots going back to fund inception (September 2019):

```
Row 9: Headers ["Date", "Gross Balance", "% change", ...]
Row 10+: Data ["9/17/2019", "$254,747.17", "0.000%", ...]
```

This data is used for:
- Historical AUM tracking
- Monthly return calculations
- Fund vs BTC comparison charts

### Sheet Structures

#### Net Returns Sheet

The Net Returns sheet uses a **pivoted format** with years as row groups and months as columns:

```
Row 0: (empty)
Row 1: "210k Capital LP Monthly Net Performance (2/20)"
Row 2: ["", "2025", "Jan 25", "Feb 25", "Mar 25", ..., "Dec 25", "2025"]
Row 3: ["", "210k Capital LP", "22.16", "4.81", "6.13", ..., "-13.80", "52.78%"]
Row 4: ["", "S&P 500", "2.38", "-1.27", "-5.57", ..., "", "-4.55%"]
Row 5: ["", "2024", "Jan 24", "Feb 24", ...]
Row 6: ["", "210k Capital LP", "0.73", "43.02", ...]
...
```

The sync logic:
1. Identifies year header rows (column B contains a 4-digit year)
2. Finds the fund returns row (contains "210k" in column B)
3. Parses month columns (e.g., "Jan 25" → January 2025)
4. Creates a snapshot for the last day of each month
5. Stores returns as decimals (22.16% → 0.2216)

#### Portfolio Statistics Sheet (PRIMARY SOURCE FOR MONTHLY RETURNS)

This sheet is the **primary source** for monthly fund and BTC returns. Format:

```
Row 0: Headers ["Date", "210k Net Monthly Returns", "BTC Return", ...]
Row 1: ["12/31/2024", "22.16%", "15.5%", ...]
Row 2: ["11/30/2024", "4.81%", "3.2%", ...]
...
```

| Column | Description |
|--------|-------------|
| A | Date (end of month) |
| B | 210k Net Monthly Returns (%) |
| C | BTC Return for comparison (%) |

The sheet also contains calculated risk metrics at the bottom:
- Sharpe Ratio (e.g., 0.84)
- Sortino Ratio (e.g., 1.20)
- Alpha (e.g., 16.70%)
- Beta (e.g., 0.95)
- Volatility (e.g., 77.32%)
- Correlation (e.g., 0.92)

#### Historical Performance Summary (Rows 1-7)

The top 7 rows contain key summary statistics. **Important:** Labels are in Column D (index 3), with Gross values in Column E and Net values in Column F:

```
Row 1: ["Fee Assumptions", "", "", "Returns (As of 12/31/24)", "Gross", "Net"]
Row 2: ["Mgmt Fee", "2%", "", "Total Return Since Inception", "1027.9%", "795.7%"]
Row 3: ["Perf Fee", "20%", "", "IRR", "58.2%", "51.4%"]
Row 4: ["", "", "", "2024 YTD Return", "201.1%", "165.2%"]
Row 5: ["", "", "", "TTM Return", "201.1%", "165.2%"]
Row 6: ["", "", "", "2024 BTC Outperformance", "81.7%", "45.8%"]
Row 7: ["", "", "", "TTM BTC Outperformance", "81.7%", "45.8%"]
```

| Row | Column D (Label) | Column E (Gross) | Column F (Net) |
|-----|------------------|------------------|----------------|
| 2 | Total Return Since Inception | 1027.9% | 795.7% |
| 3 | IRR | 58.2% | 51.4% |
| 4 | 2024 YTD Return | 201.1% | 165.2% |
| 6 | 2024 BTC Outperformance | 81.7% | 45.8% |

The sync parses Column D for labels and extracts Net values from Column F for display. These are stored in the `fund_statistics` table's `rawData` JSON column.

#### Historical Performance Data (Row 9+)

**Note:** This data is kept for reference but NOT used for the Fund vs BTC chart anymore. The "Gross Balance" column tracks a hypothetical $1,000 investment growth, NOT actual fund AUM.

---

## Database Schema

### Table: `fund_performance_snapshots`

Stores monthly fund performance data and BTC comparison.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | NO | Primary key (auto-generated) |
| snapshot_date | timestamp | NO | End-of-month date for the snapshot |
| fund_aum_usd | decimal(20,2) | YES | Fund AUM in USD |
| fund_aum_btc | decimal(20,8) | YES | Fund AUM in BTC terms |
| btc_price_at_snapshot | decimal(20,2) | YES | BTC price at snapshot time |
| net_return_mtd | decimal(10,6) | YES | Month-to-date net return (decimal, e.g., 0.05 = 5%) |
| net_return_ytd | decimal(10,6) | YES | Year-to-date net return |
| net_return_itd | decimal(10,6) | YES | Inception-to-date net return |
| btc_return_mtd | decimal(10,6) | YES | BTC month-to-date return |
| btc_return_ytd | decimal(10,6) | YES | BTC year-to-date return |
| btc_return_itd | decimal(10,6) | YES | BTC inception-to-date return |
| source_sheet | text | YES | Source sheet name ("Net Returns") |
| raw_data | jsonb | YES | Raw row data for debugging |
| synced_at | timestamp | NO | Last sync timestamp |
| created_at | timestamp | NO | Record creation time |

**Indexes:**
- `fund_performance_snapshots_date_idx` on `snapshot_date`

### Table: `fund_statistics`

Stores fund allocation percentages and risk metrics.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | NO | Primary key |
| snapshot_date | timestamp | NO | Date of statistics snapshot |
| btc_allocation | decimal(10,4) | YES | % allocated to BTC |
| equities_allocation | decimal(10,4) | YES | % allocated to BTC equities |
| cash_allocation | decimal(10,4) | YES | % in cash |
| other_allocation | decimal(10,4) | YES | % in other assets |
| volatility | decimal(10,6) | YES | Fund volatility |
| sharpe_ratio | decimal(10,4) | YES | Risk-adjusted return metric |
| max_drawdown | decimal(10,6) | YES | Maximum peak-to-trough decline |
| btc_correlation | decimal(10,4) | YES | Correlation with BTC |
| raw_data | jsonb | YES | Raw row data |
| synced_at | timestamp | NO | Last sync timestamp |

**Indexes:**
- `fund_statistics_date_idx` on `snapshot_date`

### Schema Location

```
/db/schema/fund-performance.ts
```

### Type Exports

```typescript
import type {
  InsertFundPerformanceSnapshot,
  SelectFundPerformanceSnapshot,
  InsertFundStatistics,
  SelectFundStatistics
} from "@/db/schema/fund-performance"
```

---

## Sync Cron Jobs

There are **two** cron jobs for fund performance data:

### 1. Live Fund Stats Sync (Every 4 Hours)

**Endpoint:** `/api/cron/sync-live-fund-stats`

This cron syncs real-time fund data from the Live Portfolio sheet every 4 hours. It captures:
- Current Fund AUM
- Current MTD return
- Current BTC price
- BTC holdings

| Property | Value |
|----------|-------|
| Method | GET |
| Authorization | Bearer token (`CRON_SECRET`) |
| Schedule | `0 */4 * * *` (Every 4 hours) |
| Max Duration | 60 seconds |
| Source Sheet | Live Portfolio (rows 1-4) |

**Logic:**
1. Fetches rows 1-4 from Live Portfolio sheet
2. Parses Live AUM (B1), Fund MTD (F1), BTC Price (B3), Bitcoin AUM (B4)
3. Creates or updates a snapshot for the current month (dated to end of month)
4. If a snapshot exists for the current month, it updates it; otherwise inserts new

**Response:**
```json
{
  "success": true,
  "action": "updated",  // or "inserted"
  "snapshotDate": "2026-01-31T00:00:00.000Z",
  "data": {
    "fundAumUsd": 138921796,
    "fundMtdPercent": 10.9,
    "liveBtcPrice": 87845,
    "bitcoinAum": 1581.45
  },
  "timestamp": "2026-01-29T19:02:34.121Z"
}
```

### 2. Historical Fund Performance Sync (Bi-weekly)

**Endpoint:** `/api/cron/sync-fund-performance`

This cron syncs historical monthly data from multiple sheets in a specific order.

| Property | Value |
|----------|-------|
| Method | GET |
| Authorization | Bearer token (`CRON_SECRET`) |
| Schedule | `0 2 1,15 * *` (2 AM UTC, 1st and 15th) |
| Max Duration | 60 seconds |
| Source Sheets | Portfolio Statistics, Historical Performance, Net Returns |

**Sync Order (Important):**
1. **Portfolio Statistics** (PRIMARY) - Monthly fund & BTC returns
2. **Historical Performance Summary** (rows 1-7) - ITD stats to `fund_statistics`
3. **Historical Performance Data** (row 9+) - Reference AUM data
4. **Net Returns** - Backup fund returns

**Data Preservation:**
When syncing Historical Performance data, existing `btcReturnMtd` values are preserved if the new data doesn't include them. This prevents Portfolio Statistics BTC returns from being overwritten with null.

### Vercel Cron Configuration

In `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-fund-performance",
      "schedule": "0 2 1,15 * *"
    },
    {
      "path": "/api/cron/sync-live-fund-stats",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

### Manual Trigger

```bash
# Live stats sync (recommended to run first)
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/sync-live-fund-stats

# Historical sync
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/sync-fund-performance
```

### Response Format

```json
{
  "success": true,
  "results": [
    { "sheet": "Portfolio Statistics", "synced": 77 },
    {
      "sheet": "Historical Performance (summary)",
      "synced": 1,
      "stats": {
        "totalReturnGross": 1027.9,
        "totalReturnNet": 795.7,
        "irrNet": 51.4,
        "ytdReturnNet": 165.2,
        "btcOutperformanceNet": 45.8
      }
    },
    { "sheet": "Historical Performance", "synced": 77 },
    { "sheet": "Net Returns", "synced": 0 }
  ],
  "totalSynced": 155,
  "timestamp": "2026-01-29T19:42:13.750Z"
}
```

### Error Response

```json
{
  "success": true,
  "results": [
    { "sheet": "Net Returns", "synced": 0, "error": "Date column not found" },
    { "sheet": "Portfolio Statistics", "synced": 77 }
  ],
  "totalSynced": 77,
  "timestamp": "..."
}
```

### Sync Logic Details

#### Net Returns Parsing

```typescript
// Month parsing from headers like "Jan 25", "Feb 24"
const MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
}

// "Jan 25" → { month: 0, year: 2025 }
function parseMonthYear(header: string): { month: number; year: number } | null
```

1. Scans for rows where column B contains a 4-digit year (year header)
2. Next row should contain "210k" (fund returns row)
3. For each month column (2 through N-1):
   - Parse month/year from header
   - Parse return value as percentage
   - Create snapshot dated to last day of month
   - Upsert based on `snapshot_date`

#### Portfolio Statistics Parsing (PRIMARY SOURCE)

The Portfolio Statistics sheet is the **primary source** for monthly fund and BTC returns:

```typescript
// Columns: A=Date, B=Fund Return, C=BTC Return
const dateVal = parseDate(row[0])     // "12/31/2024"
const fundReturn = parseNumber(row[1]) // "22.16%" → 22.16
const btcReturn = parseNumber(row[2])  // "15.5%" → 15.5

// Store as decimals
netReturnMtd: (fundReturn / 100).toString()  // 0.2216
btcReturnMtd: (btcReturn / 100).toString()   // 0.155
```

**Upsert Logic:**
- If snapshot exists for the date: Update `netReturnMtd` and `btcReturnMtd`
- If no snapshot exists: Insert new record
- Source sheet is marked as "Portfolio Statistics"

#### Historical Performance Summary Parsing

Parses rows 1-7 for summary statistics. Labels are in Column D, values in E (Gross) and F (Net):

```typescript
for (const row of rows) {
  const label = row[3]?.toString().toLowerCase()  // Column D

  if (label.includes("total return") && label.includes("inception")) {
    totalReturnGross = parseNumber(row[4])  // Column E
    totalReturnNet = parseNumber(row[5])    // Column F
  } else if (label.includes("irr")) {
    irrGross = parseNumber(row[4])
    irrNet = parseNumber(row[5])
  } else if (label.includes("ytd") && !label.includes("btc")) {
    ytdReturnNet = parseNumber(row[5])
  } else if (label.includes("btc outperformance") && !label.includes("ttm")) {
    btcOutperformanceNet = parseNumber(row[5])
  }
}
```

**Stored in `fund_statistics.rawData`:**
```json
{
  "source": "Historical Performance Summary (Rows 1-7)",
  "totalReturnGross": 1027.9,
  "totalReturnNet": 795.7,
  "irrGross": 58.2,
  "irrNet": 51.4,
  "ytdReturnGross": 201.1,
  "ytdReturnNet": 165.2,
  "btcOutperformanceGross": 81.7,
  "btcOutperformanceNet": 45.8,
  "lastUpdatedYear": "2024",
  "fetchedAt": "2026-01-29T19:42:13.750Z"
}
```

#### Historical Performance Data Parsing (Reference Only)

**Note:** The "Gross Balance" column in row 9+ tracks a hypothetical $1000 investment, NOT actual fund AUM. This data is synced for reference but the Fund vs BTC chart uses cumulative returns from Portfolio Statistics instead.

**Data Preservation:**
When updating existing snapshots, the sync preserves `btcReturnMtd` if the new value is null:

```typescript
if (existing.length > 0) {
  const updates = { ...snapshot }
  if (!snapshot.netReturnMtd && existing[0].netReturnMtd) {
    updates.netReturnMtd = existing[0].netReturnMtd
  }
  if (!snapshot.btcReturnMtd && existing[0].btcReturnMtd) {
    updates.btcReturnMtd = existing[0].btcReturnMtd  // Preserve!
  }
  await db.update(fundPerformanceSnapshots).set(updates)...
}
```

---

## Server Actions

### Location

```
/actions/fund-performance.ts
```

### Available Actions

#### `getFundPerformanceSnapshots(days?: number)`

Get historical fund performance snapshots.

```typescript
const snapshots = await getFundPerformanceSnapshots(365) // Last year
```

Returns: `SelectFundPerformanceSnapshot[]`

#### `getLatestFundStatistics()`

Get the most recent fund statistics record.

```typescript
const stats = await getLatestFundStatistics()
// { sharpeRatio: "1.25", btcAllocation: "0.45", ... }
```

Returns: `SelectFundStatistics | undefined`

#### `getLatestFundPerformanceSnapshot()`

Get the most recent performance snapshot.

```typescript
const latest = await getLatestFundPerformanceSnapshot()
// { netReturnYtd: "0.5278", fundAumUsd: "15000000", ... }
```

Returns: `SelectFundPerformanceSnapshot | undefined`

#### `getFundVsBtcComparison(days?: number)`

Get cumulative return comparison data for charting (base = 100).

**Note:** This function calculates cumulative returns by compounding monthly returns from Portfolio Statistics sheet, NOT from the "Gross Balance" column (which tracks a hypothetical $1000 investment, not actual AUM).

```typescript
const comparison = await getFundVsBtcComparison(365)
// [
//   { date: Date, fundNormalized: 100, btcNormalized: 100, ... },  // Starting point
//   { date: Date, fundNormalized: 122, btcNormalized: 115, ... },  // +22% fund, +15% BTC
//   ...
// ]
```

**Calculation Logic:**
```typescript
// Starting from 100, compound each month's return
let fundCumulative = 100
let btcCumulative = 100

for (const snapshot of snapshots) {
  fundCumulative = fundCumulative * (1 + fundMtd)   // e.g., 100 * 1.05 = 105
  btcCumulative = btcCumulative * (1 + btcMtd)
}
```

Returns:
```typescript
{
  date: Date
  fundNormalized: number  // Cumulative return (100 = start, 200 = doubled)
  btcNormalized: number   // Cumulative BTC return
  fundAumUsd: number      // Placeholder for tooltip display
  btcPrice: number        // BTC price at snapshot date
  netReturnMtd: number | null
  netReturnYtd: number | null
  btcReturnMtd: number | null
  btcReturnYtd: number | null
}[]
```

#### `getFundReturnsData(days?: number)`

Get monthly returns data for bar chart.

```typescript
const returns = await getFundReturnsData(365)
// [
//   { date: Date, netReturnMtd: 5.2, btcReturnMtd: 3.1, alpha: 2.1 },
//   ...
// ]
```

Returns:
```typescript
{
  date: Date
  netReturnMtd: number | null  // Already converted to percentage (5.2 = 5.2%)
  btcReturnMtd: number | null
  alpha: number | null         // Fund return - BTC return
}[]
```

#### `getFundStatisticsHistory(days?: number)`

Get historical fund statistics for trend analysis.

```typescript
const history = await getFundStatisticsHistory(365)
```

Returns: `SelectFundStatistics[]`

#### `getHistoricalSummaryStats()`

Get inception-to-date summary stats from Historical Performance sheet (rows 1-7).

```typescript
const summary = await getHistoricalSummaryStats()
// {
//   totalReturnGross: 1433.5,    // 1433.5% gross return ITD
//   totalReturnNet: 1334.6,      // 1334.6% net return ITD
//   irr: 52.7,                   // 52.7% IRR
//   ytdReturn: 60.2,             // 60.2% YTD (from sheet)
//   btcOutperformance: 66.4,     // 66.4% alpha vs BTC
//   lastUpdatedYear: "2025",
//   syncedAt: Date
// }
```

Returns:
```typescript
{
  totalReturnGross: number | null  // % gross return since inception
  totalReturnNet: number | null    // % net return since inception
  irr: number | null               // Internal rate of return %
  ytdReturn: number | null         // YTD return from sheet (year-end)
  btcOutperformance: number | null // Alpha vs Bitcoin %
  lastUpdatedYear: string | null   // Year the stats are as of
  syncedAt: Date | null
} | null
```

#### `getLiveFundStats()`

Fetch real-time fund stats directly from the Live Portfolio Google Sheet.

```typescript
const liveStats = await getLiveFundStats()
// {
//   liveAumUsd: 138921796,
//   navAumUsd: 126138563,
//   mtmAumUsd: 145751261,
//   fundMtdReturn: 0.109,  // 10.9% as decimal
//   liveBtcPrice: 87845,
//   navBtcPrice: 88264,
//   bitcoinAum: 1581.45,
//   fetchedAt: Date
// }
```

Returns:
```typescript
{
  liveAumUsd: number | null
  navAumUsd: number | null
  mtmAumUsd: number | null
  fundMtdReturn: number | null  // Decimal (0.109 = 10.9%)
  liveBtcPrice: number | null
  navBtcPrice: number | null
  bitcoinAum: number | null
  fetchedAt: Date
} | null
```

**Note:** This function makes a direct API call to Google Sheets on each invocation. For cached data, use the database snapshots populated by `sync-live-fund-stats`.

#### `getFundSummaryStats()`

Get summary statistics including properly calculated YTD return.

```typescript
const summary = await getFundSummaryStats()
// {
//   fundAumUsd: 138921796,
//   netReturnYtd: 0.109,  // 10.9% as decimal
//   lastSnapshotDate: Date,
//   monthsIncluded: 1,
//   liveMtdUsed: true
// }
```

**YTD Calculation Logic:**

1. Fetches all snapshots from the start of the current year
2. Compounds monthly returns: `YTD = (1 + Jan) × (1 + Feb) × ... - 1`
3. If current month is missing from database, fetches live MTD and includes it
4. Returns indicator of whether live data was used

Returns:
```typescript
{
  fundAumUsd: number | null
  netReturnYtd: number           // Compounded YTD return as decimal
  lastSnapshotDate: Date | null
  monthsIncluded: number         // Number of months in YTD calculation
  liveMtdUsed: boolean           // Whether live MTD was used for current month
}
```

---

## Chart Components

### Fund vs BTC Chart

**Location:** `/app/(authenticated)/dashboard/charts/_components/fund-vs-btc-chart.tsx`

**Type:** Dual-line chart (Recharts `LineChart`)

**Features:**
- Cumulative return comparison (both series start at 100)
- Orange solid line for Fund returns
- Blue dashed line for BTC returns (better contrast)
- Shows cumulative % change on Y-axis (e.g., +1234%, -50%)
- Year labels shown on January and first data point
- Reference line at 0%
- Tooltip shows percentage returns with BTC price
- **Numeric X-axis indexing** for proper tooltip/activeDot alignment

**Props:**
```typescript
interface FundVsBtcChartProps {
  data: {
    date: Date
    fundNormalized: number  // Cumulative (100 = start, 200 = doubled)
    btcNormalized: number
    fundAumUsd: number      // Not used (placeholder)
    btcPrice: number        // Shown in tooltip
  }[]
}
```

**Colors:**
```typescript
const COLORS = {
  fund: "#ff8200",  // Terminal orange (solid line)
  btc: "#60a5fa"    // Blue for better contrast (dashed line)
}
```

**Chart Display:**
- X-axis: Uses numeric index with custom tick formatter for labels
- Year shown on January and first data point (e.g., "Jan 2024", "Feb", "Mar", ...)
- Y-axis: Percentage change from start (e.g., +1234%, +500%, 0%, -50%)
- Labels interval: ~10 labels total to avoid crowding
- Labels angled at 45° for readability

**Technical Note:** The X-axis uses `type="number"` with `dataKey="index"` instead of categorical labels. This ensures proper tooltip and activeDot positioning when hovering, which was a bug with categorical axes combined with `interval`.

### Fund Returns Chart

**Location:** `/app/(authenticated)/dashboard/charts/_components/fund-returns-chart.tsx`

**Type:** Bar chart (Recharts `BarChart`) with year filter

**Features:**
- Monthly fund returns as bars
- Green for positive, red for negative
- BTC returns as semi-transparent orange bars for comparison
- Reference line at y=0
- Tooltip with color-coded percentage formatting
- **Year filter toggle** (All, 2026, 2025, 2024, ...)
- **Custom legend** with proper color indicators

**Year Filter:**
```
┌──────────────────────────────────────────────────────────┐
│                              [All] [2026] [2025] [2024]...│
│  ████                                                     │
│  ██████  ████                                             │
│  ███████ █████  ████                                      │
│ ─────────────────────────────────────────────────────────│
│  Jan    Feb    Mar    Apr    May    Jun    ...           │
│                                                          │
│  🟩🟥 Fund Return    🟧 BTC Return                        │
└──────────────────────────────────────────────────────────┘
```

When a specific year is selected:
- Only that year's 12 months are shown
- All month labels are displayed (no interval skipping)
- Chart scales to fit the year's data range

**Props:**
```typescript
interface FundReturnsChartProps {
  data: {
    date: Date
    netReturnMtd: number | null
    btcReturnMtd: number | null
    alpha: number | null
  }[]
}
```

**Colors:**
```typescript
const COLORS = {
  positive: "#00d26a",  // Green (positive fund returns)
  negative: "#ef4444",  // Red (negative fund returns)
  btc: "#f7931a"        // Bitcoin orange (60% opacity)
}
```

**Custom Legend:**
Instead of using Recharts' built-in Legend (which doesn't handle Cell-based coloring), a custom legend is rendered:
```tsx
<div className="flex items-center justify-center gap-6">
  <div className="flex items-center gap-2">
    <div className="flex gap-0.5">
      <div style={{ backgroundColor: "#00d26a" }} />  {/* Green */}
      <div style={{ backgroundColor: "#ef4444" }} />  {/* Red */}
    </div>
    <span>Fund Return</span>
  </div>
  <div className="flex items-center gap-2">
    <div style={{ backgroundColor: "#f7931a", opacity: 0.6 }} />
    <span>BTC Return</span>
  </div>
</div>
```

**Tooltip Formatting:**
- Fund Return: Color matches bar color (green for positive, red for negative)
- BTC Return: Always orange
- Labels: Light gray for readability on dark background

---

## Fund Performance Page

### Location

```
/app/(authenticated)/dashboard/fund-performance/page.tsx
```

The Fund Performance page is a dedicated page under the Analytics menu in the sidebar, separate from the Charts page.

### Navigation

```
Sidebar → Analytics → Fund Performance
URL: /dashboard/fund-performance
```

### URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `range` | Time range filter | `?range=1y`, `?range=2y`, `?range=all` |

### Range Options

| Range | Days | Description |
|-------|------|-------------|
| `1y` | 365 | Last 12 months |
| `2y` | 730 | Last 24 months |
| `all` | 3650 | All available data (~10 years) |

### Data Fetching

```typescript
const [fundComparison, fundReturns, latestFundSnapshot, fundSummary, allSnapshots, liveStats, historicalSummary] = await Promise.all([
  getFundVsBtcComparison(days),       // Cumulative return comparison data
  getFundReturnsData(days),           // Monthly returns for bar chart
  getLatestFundPerformanceSnapshot(), // Latest snapshot from DB
  getFundSummaryStats(),              // YTD calculation with live fallback
  getFundPerformanceSnapshots(days),  // All snapshots for range
  getLiveFundStats(),                 // Real-time data from Google Sheets
  getHistoricalSummaryStats()         // ITD stats (Total Return, IRR, BTC Outperformance)
])
```

### Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│ 💼 Fund Performance                           [1Y] [2Y] [ALL]│
│    210k Capital fund analytics and historical performance    │
├─────────────────────────────────────────────────────────────┤
│ Summary Cards - Row 1: Live/Current Stats                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ Fund AUM │ │YTD Return│ │MTD Return│ │ Win Rate │         │
│ │ $138.9M  │ │ +60.2%   │ │ +10.9%   │ │ 53%      │         │
│ │ live     │ │ 12 mons  │ │ Jan 2026 │ │ 41/35    │         │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
├─────────────────────────────────────────────────────────────┤
│ Summary Cards - Row 2: Inception-to-Date Stats               │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │Total Ret │ │   IRR    │ │BTC Outprf│ │Inception │         │
│ │+1334.6%  │ │ 52.7%    │ │ +66.4%   │ │ Sep 2019 │         │
│ │net ITD   │ │          │ │ vs BTC   │ │ 77 months│         │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
├─────────────────────────────────────────────────────────────┤
│ Summary Cards - Row 3: Monthly Statistics                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │Best Month│ │Worst Mon.│ │Avg Month │ │ Hit Rate │         │
│ │ +83.7%   │ │ -42.8%   │ │ +5.2%    │ │ 53%      │         │
│ │ Jun 2025 │ │ Jun 2022 │ │ avg      │ │ 41/36    │         │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
├─────────────────────────────────────────────────────────────┤
│ [Fund Performance vs Bitcoin - Dual Line Chart]              │
│ [Monthly Returns - Bar Chart]                                │
└─────────────────────────────────────────────────────────────┘
```

### Summary Cards

**Row 1: Live/Current Stats**
| Card | Data Source | Format | Notes |
|------|-------------|--------|-------|
| Fund AUM | `liveStats.liveAumUsd` | Currency compact ($138.9M) | Shows "live" indicator |
| YTD Return | `fundSummary.netReturnYtd` | Percentage with color | Shows months included |
| MTD Return | `liveStats.fundMtdReturn` | Percentage with color | Current month from live |
| Win Rate | Calculated from `fundReturns` | Percentage | Positive/negative months |

**Row 2: Inception-to-Date Stats**
| Card | Data Source | Format | Notes |
|------|-------------|--------|-------|
| Total Return (ITD) | `historicalSummary.totalReturnNet` | Percentage (green) | Net return since inception |
| IRR | `historicalSummary.irr` | Percentage | Internal rate of return |
| BTC Outperformance | `historicalSummary.btcOutperformance` | Percentage (orange) | Alpha vs Bitcoin ITD |
| Inception | First `allSnapshots` date | Month Year | Shows total months |

**Row 3: Monthly Statistics**
| Card | Data Source | Format | Notes |
|------|-------------|--------|-------|
| Best Month | Max from `fundReturns` | Percentage (green) | Shows month/year |
| Worst Month | Min from `fundReturns` | Percentage (red) | Shows month/year |
| Avg Monthly Return | Mean of `fundReturns` | Percentage | Arithmetic mean |
| Hit Rate | Calculated from `fundReturns` | Percentage | Positive vs negative months |

### Data Priority

The page uses a **live-first** approach for current data:

1. **Fund AUM**: Uses `liveStats.liveAumUsd` (real-time from Google Sheets), falls back to `fundSummary.fundAumUsd` (from database)
2. **MTD Return**: Uses `liveStats.fundMtdReturn` (real-time), falls back to `latestFundSnapshot.netReturnMtd`
3. **YTD Return**: Calculated by `getFundSummaryStats()` which compounds historical + live MTD
4. **Charts**: Use database snapshots for historical accuracy

---

## File Reference

| File | Purpose |
|------|---------|
| `/db/schema/fund-performance.ts` | Database schema definitions |
| `/db/index.ts` | Schema exports |
| `/app/api/cron/sync-fund-performance/route.ts` | Historical data sync (bi-weekly) |
| `/app/api/cron/sync-live-fund-stats/route.ts` | Live stats sync (every 4 hours) |
| `/actions/fund-performance.ts` | Server actions for data access |
| `/app/(authenticated)/dashboard/fund-performance/page.tsx` | Fund Performance page |
| `/app/(authenticated)/dashboard/charts/_components/fund-vs-btc-chart.tsx` | Normalized line chart |
| `/app/(authenticated)/dashboard/charts/_components/fund-returns-chart.tsx` | Monthly returns bar chart |
| `/app/(authenticated)/dashboard/_components/app-sidebar.tsx` | Sidebar with Fund Performance link |
| `/vercel.json` | Cron schedule configuration |

---

## Troubleshooting

### No Fund Performance Data Showing

1. **Check if sync has run:**
   ```sql
   SELECT COUNT(*) FROM fund_performance_snapshots;
   SELECT snapshot_date, fund_aum_usd, net_return_mtd, source_sheet
   FROM fund_performance_snapshots
   ORDER BY snapshot_date DESC
   LIMIT 5;
   ```

2. **Manually trigger syncs:**
   ```bash
   # First, sync live stats (gets current month data)
   curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/sync-live-fund-stats

   # Then, sync historical data
   curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/sync-fund-performance
   ```

3. **Check sync response for errors:**
   ```json
   { "sheet": "Historical Performance", "synced": 0, "error": "..." }
   ```

### YTD Return Shows 0% or Wrong Value

The YTD return is calculated by compounding all monthly returns from the current year:

1. **Check if current year has snapshots:**
   ```sql
   SELECT snapshot_date, net_return_mtd
   FROM fund_performance_snapshots
   WHERE snapshot_date >= '2026-01-01'
   ORDER BY snapshot_date;
   ```

2. **If no current year data, run live sync:**
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/sync-live-fund-stats
   ```

3. **Verify the calculation logic:**
   - YTD = (1 + Jan MTD) × (1 + Feb MTD) × ... - 1
   - If current month is missing, `getLiveFundStats()` is called as fallback

### "Date column not found" Error

This typically means the sheet structure has changed. Check:
1. Portfolio Statistics sheet has a row with "date" in the header
2. Net Returns sheet has year rows (column B = 4-digit year)

### Returns Look Wrong (Off by 100x)

Returns are stored as decimals:
- 5.2% is stored as `0.052`
- -13.8% is stored as `-0.138`

The chart components convert to display percentages.

### Fund vs BTC Chart Shows Flat BTC Line

If the BTC line is flat at 0%, the `btcReturnMtd` values are missing or null:

```sql
SELECT snapshot_date, net_return_mtd, btc_return_mtd, source_sheet
FROM fund_performance_snapshots
WHERE btc_return_mtd IS NOT NULL
ORDER BY snapshot_date DESC
LIMIT 10;
```

**Common causes:**
1. Portfolio Statistics sync hasn't run yet
2. Historical Performance sync ran AFTER Portfolio Statistics and overwrote BTC returns with null (fixed in current code)

**Fix:** Re-run the sync:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/sync-fund-performance
```

### Summary Stats (Row 2) Show N/A

If Total Return, IRR, or BTC Outperformance show "N/A":

1. **Check if fund_statistics has data:**
   ```sql
   SELECT snapshot_date, raw_data
   FROM fund_statistics
   ORDER BY snapshot_date DESC
   LIMIT 1;
   ```

2. **Verify the rawData contains the stats:**
   ```sql
   SELECT raw_data->>'totalReturnNet' as total_return,
          raw_data->>'irrNet' as irr,
          raw_data->>'btcOutperformanceNet' as btc_outperf
   FROM fund_statistics
   ORDER BY snapshot_date DESC
   LIMIT 1;
   ```

3. **If empty, re-run sync** - the Historical Performance summary parsing may have failed

### Chart Tooltip/ActiveDot Misaligned

If the hover dot appears in the wrong position on the Fund vs BTC chart:

This was a known Recharts issue with categorical X-axes combined with `interval`. The fix uses a numeric index for the X-axis:

```typescript
// Each data point has an index
const chartData = data.map((item, index) => ({
  index,  // Numeric position
  label,  // Display label
  ...
}))

// X-axis uses numeric type
<XAxis
  dataKey="index"
  type="number"
  tickFormatter={(value) => chartData.find(d => d.index === value)?.label}
/>
```

### Sharpe Ratio Shows "N/A"

The Sharpe ratio comes from the Portfolio Statistics sheet. Verify:
1. The sheet has a "sharpe" column
2. Data is being synced to `fund_statistics` table
3. Check `rawData` column for what was parsed

---

## Calculation Notes

### Cumulative Return Comparison

The Fund vs BTC chart shows cumulative returns by compounding monthly returns:

```typescript
// Starting from 100 (index value)
let fundCumulative = 100
let btcCumulative = 100

for (const snapshot of snapshots) {
  // Monthly returns are stored as decimals (0.10 = 10%)
  const fundMtd = snapshot.netReturnMtd ?? 0  // e.g., 0.10
  const btcMtd = snapshot.btcReturnMtd ?? 0   // e.g., 0.05

  // Compound the returns
  fundCumulative = fundCumulative * (1 + fundMtd)  // 100 * 1.10 = 110
  btcCumulative = btcCumulative * (1 + btcMtd)     // 100 * 1.05 = 105
}
```

The chart then shows these as percentage changes from 100:
- Fund at 1334 means +1234% cumulative return
- BTC at 800 means +700% cumulative return

**Important:** This uses monthly returns from Portfolio Statistics sheet, NOT the "Gross Balance" column from Historical Performance (which tracks a hypothetical $1000 investment growth and would show incorrect values).

### Alpha Calculation

Alpha (outperformance) = Fund Return - BTC Return

```typescript
alpha = netReturnMtd - btcReturnMtd
// If fund returned 5% and BTC returned 3%, alpha = 2%
```

### Return Storage Format

All returns are stored as decimals, not percentages:
- Input from sheet: "22.16" (percentage)
- Stored in DB: "0.2216" (decimal)
- Display in chart: Multiplied by 100 → "22.16%"

### YTD Calculation

The YTD return is calculated by **compounding** monthly returns, not summing:

```typescript
// Example: January = +10%, February = +5%
// WRONG: YTD = 10% + 5% = 15%
// CORRECT: YTD = (1.10 × 1.05) - 1 = 15.5%

let ytdReturn = 1
for (const month of monthlyReturns) {
  ytdReturn *= (1 + month.netReturnMtd)  // netReturnMtd is decimal (0.10 = 10%)
}
ytdReturn = ytdReturn - 1  // Convert back to return
```

**Handling the Current Month:**

If the current month doesn't have a database snapshot yet:
1. `getFundSummaryStats()` detects the missing month
2. Calls `getLiveFundStats()` to get real-time MTD from Google Sheets
3. Includes the live MTD in the compound calculation
4. Returns `liveMtdUsed: true` flag for UI indication

This ensures YTD is always accurate, even before the cron syncs the current month's data.

---

## Data Flow Summary

```
Google Sheets                    Cron Jobs                    Database                     UI
┌─────────────────┐             ┌─────────────┐              ┌──────────────┐             ┌─────────┐
│ Live Portfolio  │──(4 hrs)──▶│sync-live-   │────────────▶│fund_perf_    │────────────▶│ Summary │
│ (rows 1-4)      │            │fund-stats   │   upsert    │snapshots     │   query     │ Cards   │
│ - Live AUM      │             └─────────────┘   current   │              │             │ Row 1   │
│ - Fund MTD      │                                month    │              │             └─────────┘
│ - BTC Price     │                                         │              │
└─────────────────┘                                         │              │             ┌─────────┐
                                                            │              │────────────▶│ Charts  │
┌─────────────────┐             ┌─────────────┐             │              │   query     │         │
│ Portfolio Stats │──(bi-wkly)─▶│sync-fund-   │────────────▶│              │             └─────────┘
│ (PRIMARY)       │            │performance  │   upsert    │              │
│ - Fund Return%  │             │             │   monthly   └──────────────┘
│ - BTC Return%   │             │             │
└─────────────────┘             │             │              ┌──────────────┐             ┌─────────┐
                                │             │             │fund_         │────────────▶│ Summary │
┌─────────────────┐             │             │────────────▶│statistics    │   query     │ Cards   │
│ Historical Perf │             │             │   upsert    │ (rawData)    │             │ Row 2   │
│ (rows 1-7)      │             └─────────────┘   summary   │ - Total Ret  │             └─────────┘
│ - Total Return  │                                         │ - IRR        │
│ - IRR           │                                         │ - BTC Alpha  │
│ - BTC Outperf   │                                         └──────────────┘
└─────────────────┘

Real-time Fallback:
┌─────────────────┐             ┌─────────────┐                              ┌─────────┐
│ Live Portfolio  │────────────▶│getLiveFund- │─────────────────────────────▶│ Fund AUM│
│ (rows 1-4)      │   direct    │Stats()      │   used if DB                 │ MTD card│
└─────────────────┘   API call  └─────────────┘   missing current month      └─────────┘
```

---

## Performance Optimizations

### Batch BTC Price Fetching

The `getFundVsBtcComparison()` function was optimized to avoid the N+1 query problem:

**Before (slow):**
```typescript
// 77 individual database queries
for (const snapshot of snapshots) {
  const btcPrice = await getBtcPriceForDate(snapshot.snapshotDate)  // 1 query each
}
```

**After (fast):**
```typescript
// 1 batch query for all BTC prices in date range
const btcPricesData = await db
  .select()
  .from(btcPrices)
  .where(and(
    gte(btcPrices.priceAt, startDate),
    lte(btcPrices.priceAt, endDate)
  ))

// Create lookup map
const btcPriceMap = new Map<string, number>()
for (const price of btcPricesData) {
  const dateKey = price.priceAt.toISOString().split('T')[0]
  if (!btcPriceMap.has(dateKey)) {
    btcPriceMap.set(dateKey, parseFloat(price.priceUsd))
  }
}

// Use map for O(1) lookups
for (const snapshot of snapshots) {
  const btcPrice = btcPriceMap.get(dateKey) ?? 0
}
```

| Metric | Before | After |
|--------|--------|-------|
| Database queries | 78 (1 + 77) | 2 |
| Typical load time | 3-5 seconds | < 500ms |

### Date Range Fallback

If no BTC price exists for the exact snapshot date, the function looks back up to 3 days:

```typescript
if (btcPrice === 0) {
  for (let i = 1; i <= 3; i++) {
    const prevDate = new Date(snapshot.snapshotDate)
    prevDate.setDate(prevDate.getDate() - i)
    const prevKey = prevDate.toISOString().split('T')[0]
    if (btcPriceMap.has(prevKey)) {
      btcPrice = btcPriceMap.get(prevKey)!
      break
    }
  }
}
```

---

## All Cron Schedules

Complete list of cron jobs in `vercel.json`:

| Endpoint | Schedule | Frequency | Description |
|----------|----------|-----------|-------------|
| `/api/cron/btc-price` | `*/5 * * * *` | Every 5 min | BTC price updates |
| `/api/cron/stock-prices` | `*/15 * * * 1-5` | Every 15 min (Mon-Fri) | Stock prices |
| `/api/cron/fx-rates` | `0 */4 * * *` | Every 4 hours | FX rates |
| `/api/cron/sync-sheets` | `0 */4 * * *` | Every 4 hours | General sheets sync |
| `/api/cron/daily-snapshot` | `0 0 * * *` | Daily midnight UTC | Daily snapshots |
| `/api/cron/check-alerts` | `*/5 * * * *` | Every 5 min | Price alerts |
| `/api/cron/sync-portfolio` | `0 */4 * * *` | Every 4 hours | Portfolio positions |
| `/api/cron/sync-fund-performance` | `0 2 1,15 * *` | Bi-weekly (1st & 15th) | Historical fund data |
| `/api/cron/sync-live-fund-stats` | `0 */4 * * *` | Every 4 hours | Live AUM & MTD |

**Fund Performance specific:**
- `btc-price`: Provides BTC prices for tooltip display in charts
- `sync-fund-performance`: Syncs monthly returns from Portfolio Statistics sheet
- `sync-live-fund-stats`: Syncs real-time AUM and MTD from Live Portfolio sheet

---

## Related Documentation

- [PORTFOLIO_POSITIONS.md](./PORTFOLIO_POSITIONS.md) - Live Portfolio sync from same spreadsheet
- [HISTORICAL_DATA.md](./HISTORICAL_DATA.md) - Stock/BTC/FX data infrastructure
- [DATA_MODEL.md](./DATA_MODEL.md) - Complete database schema
- [API_INTEGRATIONS.md](./API_INTEGRATIONS.md) - Google Sheets API setup
