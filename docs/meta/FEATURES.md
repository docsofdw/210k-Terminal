# Feature Specifications

## MVP Features (Phase 1)

### 1. Comps Table Dashboard

Interactive table displaying all tracked treasury companies with key metrics.

**User Stories:**
- As an analyst, I want to see all company metrics in a sortable/filterable table to quickly compare valuations
- As an analyst, I want to click a company row to see detailed information
- As a viewer, I want prices to update automatically without manual refresh

**Acceptance Criteria:**
- Table displays all 15 companies with all metrics from existing Comps Table
- Columns sortable by clicking headers
- Filter by: company name, mNAV range, country
- Stock prices refresh every 15 minutes during market hours
- BTC price refreshes every 1 minute
- All calculations match existing spreadsheet formulas exactly

**UI Requirements:**
- Full-width data table with horizontal scroll
- Sticky header row and first column (company name)
- Color coding: Green (mNAV < 1), Red (mNAV > 2), Yellow (watch zone)
- BTC price ticker in header (always visible)
- Last updated timestamp
- Quick filters: All / Portfolio Only / Watchlist Only

---

### 2. Alert System

Automated notification system for material events.

**Alert Types:**

| Alert Type | Trigger | Channel | Priority |
|------------|---------|---------|----------|
| BTC Purchase/Sale | AI detects announcement | Telegram | High |
| mNAV Breach | Crosses configured threshold | Telegram | High |
| Large Price Move | > 5% daily change | Telegram | Medium |
| New Filing | Document detected on IR page | Slack | Medium |
| Data Pending Approval | AI extraction awaiting review | Telegram | High |
| Daily Summary | Scheduled 9am ET | Slack | Low |
| Weekly Digest | Monday 9am ET | Slack | Low |

See [ALERTS.md](./ALERTS.md) for detailed specifications.

---

### 3. Admin Data Entry Interface

Forms for administrators to manually enter or update company data.

**Required Forms:**
- **Company Master Data:** Add/edit company profiles (ticker, exchange, currency, IR URL)
- **BTC Holdings Update:** Record new BTC balance with source reference
- **Financial Data:** Update debt, cash, preferreds, share count
- **AI Data Review:** Approve/reject/edit AI-extracted data

**Features:**
- Validation on all inputs
- Audit logging for all changes
- Source URL/reference required for holdings updates

---

### 4. Value Screener

Relative value screening tool to identify treasury companies trading at attractive valuations.

**Location:** `/dashboard/charts` (sidebar: Analytics → Value Screener)

**Tabs:**
- **Value Screener** (default) - Screening table for all companies
- **Company Analysis** - Per-company charts (appears when a company is selected)

**Metrics Displayed:**

| Column | Description |
|--------|-------------|
| Signal | Color-coded badge (Attractive/Fair/Expensive) |
| Rank | Position by current mNAV (1 = lowest/cheapest) |
| Company | Ticker + company name (clickable to drill down) |
| mNAV | Current mNAV multiple |
| vs 90d Avg | Deviation from 90-day average mNAV (%) |
| 7d Δ | mNAV change over last 7 days |
| Trend | 90-day sparkline with average reference line |
| BTC | Current BTC holdings |
| Mkt Cap | Market capitalization (USD) |

**Signal Logic:**
- **Attractive (Green):** mNAV < 1.0, OR deviation < -10%, OR (rank ≤ 3 AND deviation < 0)
- **Expensive (Red):** mNAV > 2.0, OR deviation > +15%
- **Fair (Yellow):** Everything else

**Data Filtering:**
- Companies with negative or null mNAV values are excluded from the screener
- This filters out companies with data quality issues (e.g., negative EV or negative BTC NAV)

**Sorting:**
- All columns are sortable by clicking headers
- Default sort: by Rank (ascending)

**Data Source:**
- Aggregates data from `daily_snapshots` table (last 90 days)
- Server action: `getRelativeValueScreenerData()` in `/actions/snapshots.ts`

#### Company Analysis Tab

Per-company historical charts (appears when a company is selected from the dropdown).

**Charts:**
- mNAV History - Historical mNAV over the selected time range
- Stock Price History - Stock price in the company's trading currency

**Controls:**
- Company selector dropdown
- Date range selector (7D, 30D, 90D, 1Y, ALL)

---

### 5. Portfolio Tracker

Track 210k Capital's positions in treasury companies.

**Core Functionality:**
- Add position: Record purchase (company, quantity, price, date, custodian)
- Trim position: Record partial sale
- Exit position: Record full sale
- No dividend/distribution tracking required

**Display Metrics:**
- Position value (USD and BTC)
- Portfolio weight (%)
- Delta % (beta to BTC)
- Bitcoin Delta (delta-weighted BTC exposure)

**UI Requirements:**
- Summary cards: Total AUM (USD/BTC), BTC Delta, % Long
- Position table grouped by custodian
- Pie chart of portfolio weights
- Add Position / Record Transaction buttons (admin only)

---

### 6. Watchlist

Monitor additional treasury companies not in portfolio.

**Functionality:**
- Add company to watchlist with ticker/exchange
- Automatically fetch price data via Yahoo Finance
- Manual entry of BTC holdings (no AI monitoring unless promoted)
- Calculate basic metrics (mNAV) for comparison

---

### 7. Audit Log

Compliance-ready log of all data changes.

**Tracked Events:**
- All manual data entry (who, what, when, old value, new value)
- AI data approvals/rejections
- Portfolio position changes
- User login/logout events

---

### 8. Snapshot History

View the Comps Table as it appeared on any historical date.

**Implementation:**
- Daily snapshots stored automatically at market close
- Date picker to select historical view
- Compare two dates side-by-side

---

## Phase 2 Features

### 1. Scenario Modeling

What-if analysis tools replicating Hypothetical Comps Table.

**Hypothetical Comps:**
- Adjust any input (BTC holdings, share count, price, debt, cash)
- See recalculated metrics instantly
- Model equity raises: input raise amount, see diluted BTC/share
- Model convertible note conversions
- Model preferred stock conversions

**Monte Carlo Simulation:**
- BTC price distribution: Log-normal
- Time horizons: 90 days, 1 year, 5 years
- Output: mNAV distribution, probability of covering premium

---

### 2. Black-Scholes for Convertible Bonds

Option pricing model for analyzing convertible bond opportunities.

**Inputs:**
- Bond price
- Conversion price
- Maturity
- Volatility
- Risk-free rate

**Outputs:**
- Theoretical value
- Implied volatility
- Greeks (delta, gamma, theta, vega)

---

### 3. Market Data Dashboard

Aggregate view of Bitcoin and macro market conditions.

**Widgets:**
- BTC price with 24h change
- Fear/Greed index
- Relevant macro indicators
- Market summary

---

### 4. Company Deep-Dive Pages

Dedicated page per company with comprehensive data.

**Includes:**
- Full history of BTC holdings
- All filings
- News feed
- Advanced analytics
- Price charts
