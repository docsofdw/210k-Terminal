# Data Model

Database uses Supabase (PostgreSQL) with Drizzle ORM.

## Entity Relationship Overview

```
companies (1) ──────┬──── (*) holdings_snapshots
                    ├──── (*) stock_prices
                    ├──── (*) fund_positions (synced from Google Sheets)
                    ├──── (*) alerts ──── (*) alert_history
                    └──── (*) ai_extractions

btc_prices (standalone)
fx_rates (standalone)
daily_snapshots (standalone)
audit_log (standalone)
fund_performance_snapshots (standalone, synced from Google Sheets)
fund_statistics (standalone, synced from Google Sheets)
```

## Core Tables

### companies

Primary table for tracked treasury companies.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Unique identifier |
| name | varchar(255) | NOT NULL | Company display name |
| ticker | varchar(20) | NOT NULL | Stock ticker symbol |
| exchange | varchar(50) | NOT NULL | Exchange code (NASDAQ, TSX-V, etc.) |
| country | varchar(100) | NOT NULL | Country of listing |
| currency | varchar(3) | NOT NULL | Local currency code |
| ir_url | varchar(500) | | Investor relations page URL |
| twitter_handle | varchar(100) | | Company Twitter for monitoring |
| is_active | boolean | default true | Currently tracked |
| is_watchlist | boolean | default false | Watchlist vs full tracking |
| first_btc_purchase | date | | Date of first BTC acquisition |
| created_at | timestamp | default now() | Record creation time |
| updated_at | timestamp | | Last update time |

---

### holdings_snapshots

Point-in-time BTC holdings and financial data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Unique identifier |
| company_id | uuid | FK companies | Reference to company |
| snapshot_date | date | NOT NULL | Date of snapshot |
| btc_holdings | decimal(18,8) | NOT NULL | Total BTC held |
| share_count | bigint | | Fully diluted shares |
| debt_usd | decimal(18,2) | | Total debt in USD |
| cash_usd | decimal(18,2) | | Cash and equivalents |
| preferreds_usd | decimal(18,2) | | Preferred stock value |
| source | varchar(100) | | Data source (filing, IR, AI) |
| source_url | varchar(500) | | Link to source document |
| is_verified | boolean | default false | Human verified |
| verified_by | uuid | FK users | Who verified |
| created_at | timestamp | default now() | |

---

### stock_prices

Historical stock price data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| company_id | uuid | FK companies | |
| price_date | date | NOT NULL | |
| price_local | decimal(18,6) | NOT NULL | Price in local currency |
| price_usd | decimal(18,6) | | Price converted to USD |
| fx_rate | decimal(18,8) | | FX rate used |
| market_cap_usd | decimal(18,2) | | Market cap at this price |
| source | varchar(50) | | yahoo, manual |
| created_at | timestamp | default now() | |

---

### btc_prices

Bitcoin price history.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| price_timestamp | timestamp | NOT NULL, UNIQUE | |
| price_usd | decimal(18,2) | NOT NULL | |
| source | varchar(50) | | coingecko, binance |
| created_at | timestamp | default now() | |

---

### fx_rates

Foreign exchange rates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| currency_pair | varchar(7) | NOT NULL | e.g., JPYUSD |
| rate_date | date | NOT NULL | |
| rate | decimal(18,8) | NOT NULL | |
| source | varchar(50) | | |
| created_at | timestamp | default now() | |

---

### fund_positions

210k Capital fund positions synced from Google Sheets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| category | enum | NOT NULL | btc, btc_equities, cash, debt, other |
| custodian | text | NOT NULL | Exchange or broker name |
| position_name | text | NOT NULL | Position description |
| company_id | uuid | FK companies, nullable | Linked company (for equities) |
| quantity | decimal(20,8) | NOT NULL | Number of shares/units/BTC |
| price_usd | decimal(20,8) | | Price per unit in USD |
| value_usd | decimal(20,2) | NOT NULL | Total position value (MTM) |
| value_btc | decimal(20,8) | | Position value in BTC terms |
| weight_percent | decimal(10,4) | | Portfolio weight percentage |
| synced_at | timestamp | NOT NULL | Last sync timestamp |

**Note:** This table is populated exclusively via the `/api/cron/sync-portfolio` endpoint which reads from the "210k Portfolio Stats" Google Sheet. Manual edits are overwritten on each sync.

See [PORTFOLIO_POSITIONS.md](./PORTFOLIO_POSITIONS.md) for detailed sync documentation.

---

### alerts

Alert configuration and history.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| alert_type | varchar(50) | NOT NULL | mnav_breach, price_move, filing, etc. |
| company_id | uuid | FK companies, nullable | NULL for global alerts |
| threshold_value | decimal(18,6) | | Trigger threshold |
| threshold_type | varchar(20) | | above, below, change_pct |
| is_active | boolean | default true | |
| created_at | timestamp | default now() | |

---

### alert_history

Log of triggered alerts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| alert_id | uuid | FK alerts | |
| triggered_at | timestamp | NOT NULL | |
| trigger_value | decimal(18,6) | | Value that triggered alert |
| message | text | | Alert message sent |
| channels_sent | varchar[] | | telegram, slack |
| acknowledged_at | timestamp | | When user acknowledged |
| acknowledged_by | uuid | FK users | |

---

### audit_log

Compliance audit trail.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| user_id | uuid | FK users | |
| action | varchar(100) | NOT NULL | create, update, delete, approve |
| entity_type | varchar(100) | NOT NULL | companies, holdings, positions |
| entity_id | uuid | NOT NULL | |
| old_value | jsonb | | Previous state |
| new_value | jsonb | | New state |
| ip_address | varchar(45) | | |
| created_at | timestamp | default now() | |

---

### daily_snapshots

End-of-day snapshot for historical views.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| snapshot_date | date | NOT NULL, UNIQUE | |
| btc_price_usd | decimal(18,2) | NOT NULL | |
| comps_data | jsonb | NOT NULL | Full comps table as JSON |
| portfolio_data | jsonb | | Portfolio state as JSON |
| created_at | timestamp | default now() | |

---

### ai_extractions

AI-extracted data pending review.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| company_id | uuid | FK companies | |
| extraction_type | varchar(50) | NOT NULL | btc_purchase, filing, etc. |
| source_url | varchar(500) | | URL of source |
| source_text | text | | Raw text extracted |
| extracted_data | jsonb | NOT NULL | Structured data |
| confidence_score | decimal(3,2) | | 0.00 to 1.00 |
| status | varchar(20) | default pending | pending, approved, rejected |
| reviewed_by | uuid | FK users | |
| reviewed_at | timestamp | | |
| created_at | timestamp | default now() | |

---

### fund_performance_snapshots

Monthly fund performance data synced from Google Sheets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| snapshot_date | timestamp | NOT NULL, indexed | End-of-month date |
| fund_aum_usd | decimal(20,2) | | Fund AUM in USD |
| fund_aum_btc | decimal(20,8) | | Fund AUM in BTC terms |
| btc_price_at_snapshot | decimal(20,2) | | BTC price at snapshot |
| net_return_mtd | decimal(10,6) | | Month-to-date net return (decimal) |
| net_return_ytd | decimal(10,6) | | Year-to-date net return |
| net_return_itd | decimal(10,6) | | Inception-to-date net return |
| btc_return_mtd | decimal(10,6) | | BTC MTD return for comparison |
| btc_return_ytd | decimal(10,6) | | BTC YTD return |
| btc_return_itd | decimal(10,6) | | BTC ITD return |
| source_sheet | text | | Source sheet name |
| raw_data | jsonb | | Raw row data for debugging |
| synced_at | timestamp | NOT NULL | Last sync time |
| created_at | timestamp | default now() | |

**Note:** Synced via `/api/cron/sync-fund-performance` from "Net Returns" sheet. See [FUND_PERFORMANCE.md](./FUND_PERFORMANCE.md) for details.

---

### fund_statistics

Fund allocation and risk metrics synced from Google Sheets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| snapshot_date | timestamp | NOT NULL, indexed | Date of statistics |
| btc_allocation | decimal(10,4) | | % allocated to BTC |
| equities_allocation | decimal(10,4) | | % in BTC equities |
| cash_allocation | decimal(10,4) | | % in cash |
| other_allocation | decimal(10,4) | | % in other assets |
| volatility | decimal(10,6) | | Fund volatility |
| sharpe_ratio | decimal(10,4) | | Sharpe ratio |
| max_drawdown | decimal(10,6) | | Maximum drawdown |
| btc_correlation | decimal(10,4) | | Correlation with BTC |
| raw_data | jsonb | | Raw row data |
| synced_at | timestamp | NOT NULL | Last sync time |

**Note:** Synced via `/api/cron/sync-fund-performance` from "Portfolio Statistics" sheet. See [FUND_PERFORMANCE.md](./FUND_PERFORMANCE.md) for details.
