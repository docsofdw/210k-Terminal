# Portfolio Positions System

This document describes the portfolio positions sync system for 210k Terminal.

---

## Overview

The portfolio page displays fund-level positions synced automatically from a Google Sheet. This replaces manual position entry - all position data comes exclusively from the Google Sheet source of truth.

---

## Data Source

**Google Sheet:** `1R5ZXjN3gDb7CVTrbUdqQU_HDLM2cFVUGS5CNynslAzE`
**Sheet Name:** `Live Portfolio`

The sheet must be shared with the service account:
```
id-10k-terminal-sheet@k-terminal-485321.iam.gserviceaccount.com
```

---

## Sync Schedule

- **Frequency:** Every 4 hours
- **Cron:** `0 */4 * * *`
- **Endpoint:** `/api/cron/sync-portfolio`

The sync replaces all existing positions with fresh data from the sheet on each run.

---

## Position Categories

| Category | Description |
|----------|-------------|
| `btc` | Direct BTC holdings at exchanges (Kraken, Coinbase, SFOX, etc.) |
| `btc_equities` | Stock positions in treasury companies |
| `cash` | USD and stablecoin balances |
| `debt` | Margin loans and credit facilities |
| `other` | Miscellaneous positions |

---

## Sheet Structure

The sync reads from the "Live Portfolio" sheet with this structure:

**Header Row (Row 5):**
| Column | Index | Field | Used For |
|--------|-------|-------|----------|
| A | 0 | Exchange/Custody | `custodian` |
| B | 1 | Category | Category detection |
| C | 2 | Position | `positionName` |
| D | 3 | Quantity | `quantity` |
| E | 4 | Price (Local) | Not used |
| F | 5 | Price (USD) | `priceUsd` |
| G | 6 | Value (USD) | Fallback for valueUsd |
| H | 7 | Value (USD MTM) | `valueUsd` (preferred - live mark-to-market) |
| I | 8 | Value (BTC) | `valueBtc` |
| J | 9 | % Weight | `weightPercent` |

> **Important:** The sync uses **Column H (Value USD MTM)** for the live market value, falling back to Column G (cost basis) if MTM is not available.

**Category Sections:**
- Rows are grouped by category headers (BTC, BTC Equities, Cash, Debt)
- The sync detects category headers and assigns positions accordingly
- Category matching is case-insensitive and supports partial matches

---

## Database Schema

```sql
CREATE TABLE fund_positions (
  id UUID PRIMARY KEY,
  category fund_position_category NOT NULL,  -- btc, btc_equities, cash, debt, other
  custodian TEXT NOT NULL,                   -- Exchange or broker name
  position_name TEXT NOT NULL,               -- Position description
  company_id UUID REFERENCES companies(id),  -- Linked company (for equities)
  quantity DECIMAL(20,8) NOT NULL,
  price_usd DECIMAL(20,8),
  value_usd DECIMAL(20,2) NOT NULL,
  value_btc DECIMAL(20,8),
  weight_percent DECIMAL(10,4),
  synced_at TIMESTAMP NOT NULL
);
```

---

## Company Linking

Equity positions are automatically linked to companies in the database when the position name matches. The sync uses partial string matching (case-insensitive):

| Sheet Position Name | Linked Ticker |
|---------------------|---------------|
| American Bitcoin | ABTC |
| Bitcoin Treasury | BTCT.V |
| Oranje | OBTC3 |
| DigitalX | DCC.AX |
| DigitalX Limited | DCC.AX |
| Aifinyo | EBEN.HM |
| Metaplanet | 3350.T |
| That's So Meta | 3350.T |
| LQWD | LQWD.V |
| Matador | MATA.V |
| Moon Inc | 1723.HK |
| DV8 | DV8.BK |
| Smarter Web | SWC.AQ |
| Capital B | ALCPB.PA |
| Satsuma | SATS.L |
| Bitplanet | 049470.KQ |
| Treasury BV | TRSR |

To add new company mappings, edit `POSITION_TO_TICKER` in:
`app/api/cron/sync-portfolio/route.ts`

---

## Key Files

| File | Purpose |
|------|---------|
| `db/schema/fund-positions.ts` | Database schema |
| `app/api/cron/sync-portfolio/route.ts` | Sync cron endpoint |
| `app/(authenticated)/dashboard/portfolio/page.tsx` | Portfolio page |
| `app/(authenticated)/dashboard/portfolio/_components/fund-positions-table.tsx` | Positions table component |

---

## Manual Sync

To manually trigger a sync:

```bash
curl -X GET "https://terminal.utxomanagement.com/api/cron/sync-portfolio" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Response:
```json
{
  "success": true,
  "inserted": 46,
  "timestamp": "2026-01-28T02:16:18.921Z"
}
```

---

## Sync Safety Features

The sync includes several safety mechanisms:

1. **No-data protection:** If no valid positions are found in the sheet, the sync aborts without deleting existing data
2. **Row limit:** Reads up to 200 rows (expandable in code if needed)
3. **Flexible parsing:** Handles various currency formats ($, €, £, ¥, etc.) and percentage symbols
4. **Category fallback:** Unknown categories default to "other"
5. **Value fallback:** Uses MTM value (column H), falls back to cost basis (column G) if unavailable

---

## UI Features

The portfolio page displays:

1. **Summary Cards**
   - Total positions count
   - Portfolio value (USD)
   - Portfolio value (BTC)
   - Current BTC price

2. **Category Breakdown**
   - Color-coded badges for each category
   - USD total per category
   - Position count per category
   - Categories display in order: Equities → BTC → Cash → Debt → Other

3. **Positions Table**
   - Category badge
   - Custodian/broker
   - Position name (linked to company if equity)
   - Quantity
   - Price (USD)
   - Value (USD)
   - Value (BTC)
   - Weight %

4. **Last Sync Timestamp**
   - Displayed in page header

---

## Troubleshooting

### Positions not showing
1. Check the Google Sheet is shared with the service account
2. Run a manual sync and check the response
3. Verify `GOOGLE_SERVICE_ACCOUNT_KEY` env var is set

### Sync failing
1. Check Vercel function logs
2. Verify sheet structure matches expected format
3. Ensure `CRON_SECRET` is set for authentication

### Company not linked
Add the position name mapping to `POSITION_TO_TICKER` in:
`app/api/cron/sync-portfolio/route.ts`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Yes | Service account JSON for Sheets API |
| `CRON_SECRET` | Yes | Bearer token for cron authentication |
