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

### 4. Historical Charts

Time-series visualizations for key metrics.

**Required Charts:**
- mNAV over time (per company and comparison view)
- BTC holdings accumulation (per company)
- Stock price vs BTC price correlation
- BTC Yield progression

**Implementation:**
- Recharts or TradingView lightweight charts
- Date range selector
- Export to PNG/CSV

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
