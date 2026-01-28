# Next Steps & Refinements

This document outlines recommended improvements, testing requirements, and potential enhancements for the 210k Terminal platform.

---

## Priority 1: Critical Testing

### 1.1 Cron Job Verification

**Daily Snapshot Cron**
- [ ] Wait for midnight UTC and verify snapshot creation
- [ ] Check `daily_snapshots` table has entries for all companies
- [ ] Check `market_snapshots` table has aggregate entry
- [ ] Verify Google Sheets fallback triggers when DB data is missing

**Test manually**:
```bash
curl -X GET "https://your-domain.vercel.app/api/cron/daily-snapshot" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Verify in database**:
```sql
SELECT * FROM daily_snapshots ORDER BY created_at DESC LIMIT 20;
SELECT * FROM market_snapshots ORDER BY snapshot_date DESC LIMIT 5;
```

---

### 1.2 Alert System Testing

**Test Telegram Notifications**:
1. Create a test alert with a threshold that will trigger immediately
2. Verify message is received in Telegram
3. Check `alert_history` table for the record
4. Verify cooldown prevents re-triggering

**Test Slack Notifications**:
1. Create alert with Slack channel configured
2. Verify webhook posts successfully
3. Check message formatting in Slack

**Manual Trigger Test**:
```typescript
// Add temporary endpoint or run in console
import { checkAndTriggerAlerts } from "@/actions/alerts"
await checkAndTriggerAlerts()
```

---

### 1.3 Data Integrity Checks

**Verified (2026-01-27)**:
- [x] Compare mNAV for each company between app and Google Sheet ✅
- [x] Compare BTC NAV values ✅
- [x] Compare sats per share calculations ✅
- [x] Verify FX rate conversions for non-USD stocks ✅

**Result**: Formulas correct. Differences due to timing/source variations (BTC price, stock prices).
See BUILD_LOG_2026-01-27.md for details.

**SQL Queries for Validation**:
```sql
-- Check for companies with missing critical data
SELECT ticker, name, btc_holdings, shares_outstanding, cash_usd, debt_usd
FROM companies
WHERE btc_holdings IS NULL OR shares_outstanding IS NULL;

-- Check for recent price data
SELECT c.ticker, sp.price, sp.price_at
FROM companies c
LEFT JOIN stock_prices sp ON c.id = sp.company_id
ORDER BY sp.price_at DESC
LIMIT 20;
```

---

## Priority 2: UI/UX Improvements

### 2.1 Charts Page Enhancements

**Current State**: Line/area charts with market aggregate data AND individual company views.

**Completed (2026-01-27)**:

1. **Company Selector for Charts** ✅
   - Dropdown to view individual company mNAV/price history
   - Shows company-specific charts when selected
   - URL param persistence (`?company=TICKER`)

2. **Date Range Selector** ✅
   - Buttons: 7D, 30D, 90D (default), 1Y, ALL
   - URL param persistence (`?days=30`)

3. **Chart Tooltips**
   - Add more context (% change, company breakdown)
   - Show date in more readable format

4. **Comparison Mode**
   - Select 2-3 companies to overlay on same chart
   - Useful for relative performance analysis

**Implementation Location**: `/app/(authenticated)/dashboard/charts/`

---

### 2.2 Comps Table Enhancements

**Completed (2026-01-27)**:

1. **Sorting** ✅
   - Column header click to sort (was already implemented)
   - Supports: name, BTC holdings, mNAV, market cap, sats/share, premium

2. **Filtering** ✅
   - Filter by exchange dropdown
   - Filter by currency dropdown
   - Search by ticker/name
   - Shows "X of Y companies" count
   - Clear button for active filters

3. **Column Visibility**
   - Let users show/hide columns
   - Save preferences to localStorage

4. **Export**
   - Add CSV export button
   - Export current view with filters applied

**Implementation Location**: `/app/(authenticated)/dashboard/comps/_components/`

---

### 2.3 Watchlist Improvements

1. **Drag & Drop Reordering**
   - Allow users to reorder their watchlist
   - Use `sortOrder` field already in schema

2. **Quick Add from Comps Table**
   - Add star icon on each row in comps table
   - One-click add to watchlist

3. **Price Alerts from Watchlist**
   - "Set Alert" button on each watchlist item
   - Pre-fills company in alert dialog

---

### 2.4 Portfolio Improvements

1. **Performance Metrics**
   - Total return ($ and %)
   - BTC-adjusted return
   - Time-weighted return

2. **Chart Integration**
   - Portfolio value over time chart
   - Requires storing daily portfolio snapshots

3. **Import/Export**
   - CSV import for bulk transaction entry
   - Export transaction history

---

## Priority 3: Data Quality

### 3.1 Stock Price Data Gaps

**Known Issues**:
- Some international stocks may have delayed/missing data from Yahoo Finance
- Private companies (TRSR) have no price feed

**Solutions**:

1. **Manual Price Override**
   - Admin page to manually enter prices for specific companies
   - Useful for illiquid/private companies

2. **Multiple Data Sources**
   - Add fallback to Alpha Vantage or Finnhub
   - Implement source priority chain

3. **Stale Data Alerts**
   - Notify admins when stock price is >24h old
   - Highlight stale data in UI

---

### 3.2 BTC Holdings Updates

**Current State**: Manually updated via admin panel.

**Improvements**:

1. **Holdings Update Reminders**
   - Email/Slack alert when company announces new holdings
   - Track 8-K filings for US companies

2. **Holdings Change History**
   - Already have `holdings_snapshots` table
   - Build UI to view history per company

3. **Source Documentation**
   - Add field for "source URL" when updating holdings
   - Audit trail for data verification

---

### 3.3 FX Rate Accuracy

**Current State**: Daily update at 6am UTC.

**Improvements**:

1. **More Frequent Updates**
   - Consider hourly updates during market hours
   - Important for accurate mNAV calculations

2. **Historical FX Rates**
   - Store historical rates for accurate historical snapshots
   - Currently uses latest rate for all historical calcs

---

## Priority 4: Performance Optimization

### 4.1 Database Queries

**Potential Bottlenecks**:

1. **Comps Table Load**
   - Fetches all companies, all prices, all FX rates
   - Consider caching or materialized view

2. **Chart Data**
   - 90 days × 15 companies = 1,350 rows
   - Add pagination or server-side aggregation

**Solutions**:

1. **Add Database Indexes** (if not exists):
   ```sql
   CREATE INDEX idx_stock_prices_company_date
   ON stock_prices(company_id, price_at DESC);

   CREATE INDEX idx_daily_snapshots_date
   ON daily_snapshots(snapshot_date DESC);
   ```

2. **Implement Caching**:
   - Use Next.js `unstable_cache` for expensive queries
   - Cache invalidation on data updates

3. **Consider Materialized View**:
   - Pre-calculate latest metrics per company
   - Refresh on schedule or trigger

---

### 4.2 Bundle Size

**Current Chart Page**: 119 kB (large due to recharts)

**Optimizations**:

1. **Dynamic Imports**:
   ```typescript
   const MNavChart = dynamic(() => import('./_components/mnav-chart'), {
     loading: () => <Skeleton className="h-[300px]" />
   })
   ```

2. **Tree Shaking**:
   - Import only used recharts components
   - Currently importing all

---

## Priority 5: Security & Reliability

### 5.1 Authentication Checks

**Verify**:
- [ ] All dashboard routes require authentication
- [ ] Admin routes check for admin role
- [ ] API routes validate user session
- [ ] Cron routes validate CRON_SECRET

**Test Cases**:
```bash
# Should return 401
curl https://your-domain/api/cron/daily-snapshot

# Should return 401 (no auth)
curl https://your-domain/dashboard/admin/companies
```

---

### 5.2 Input Validation

**Review Areas**:

1. **Alert Thresholds**
   - Validate numeric input
   - Prevent negative values where inappropriate
   - Cap maximum values to prevent overflow

2. **Transaction Values**
   - Validate share counts are positive
   - Validate prices are positive
   - Check for reasonable bounds

3. **SQL Injection**
   - All queries use Drizzle ORM (safe by default)
   - Verify no raw SQL with user input

---

### 5.3 Error Handling

**Improvements Needed**:

1. **Cron Job Monitoring**
   - Send alert if cron fails
   - Log errors to external service (Sentry, etc.)

2. **API Error Responses**
   - Standardize error format
   - Don't leak internal errors to client

3. **Graceful Degradation**
   - Show cached data if live fetch fails
   - Display "data unavailable" vs crash

---

## Priority 6: New Features

### 6.1 Notifications Expansion

1. **Email Notifications**
   - Add SendGrid/Resend integration
   - Email channel for alerts

2. **SMS Notifications**
   - Twilio integration for critical alerts
   - Premium feature for important thresholds

3. **Push Notifications**
   - Web push for browser notifications
   - Useful for price alerts

---

### 6.2 Social Features

1. **Shared Watchlists**
   - Create public watchlists
   - Shareable link

2. **Comments/Notes**
   - Per-company discussion thread
   - Shared among team members

---

### 6.3 Advanced Analytics

1. **Correlation Analysis**
   - BTC price vs company prices
   - mNAV vs BTC price

2. **Screening Tools**
   - Find companies by criteria
   - "mNAV < 1.5 AND holdings > 10,000"

3. **Monte Carlo Simulations**
   - Project future mNAV based on BTC scenarios
   - Sensitivity analysis

---

### 6.4 API Access

1. **Public API**
   - REST endpoints for data access
   - Rate limiting and API keys

2. **Webhook Subscriptions**
   - Push notifications on data changes
   - Integrate with other systems

---

## Testing Checklist

### Functional Tests

- [ ] User can sign up and sign in
- [ ] User can view comps table with accurate data
- [ ] User can add/remove positions
- [ ] User can record transactions
- [ ] User can create alerts with all types
- [ ] User can add companies to watchlist
- [ ] Admin can edit company data
- [ ] Admin can view audit log
- [ ] Charts display when data exists
- [ ] History shows past snapshots
- [ ] Date picker only shows available dates

### Data Accuracy Tests

- [ ] mNAV calculation matches spreadsheet
- [ ] BTC NAV calculation is correct
- [ ] EV calculation includes debt + preferreds - cash
- [ ] FX conversion applied correctly
- [ ] Sats per share = (holdings × 100M) / shares

### Edge Cases

- [ ] Empty states display correctly (no positions, no alerts, etc.)
- [ ] Missing price data handled gracefully
- [ ] Private company (no price feed) displays correctly
- [ ] Very large numbers formatted correctly
- [ ] Negative P&L displays in red

### Performance Tests

- [ ] Comps table loads in <2 seconds
- [ ] Charts render smoothly
- [ ] No memory leaks on navigation
- [ ] Mobile responsive layout works

---

## Deployment Checklist

### Before Production

- [ ] All environment variables set in Vercel
- [ ] Database migrations applied
- [ ] Google Sheets shared with service account
- [ ] Telegram bot configured and tested
- [ ] Slack webhook configured and tested
- [ ] Cron jobs verified working

### Monitoring Setup

- [ ] Vercel Analytics enabled
- [ ] Error tracking (Sentry) configured
- [ ] Uptime monitoring configured
- [ ] Database connection monitoring

---

## Documentation Needed

1. **User Guide**
   - How to use each feature
   - Screenshots and walkthroughs

2. **Admin Guide**
   - How to update company data
   - How to manage users

3. **API Documentation**
   - Internal API endpoints
   - Webhook payloads

4. **Runbook**
   - Common issues and fixes
   - How to restart crons
   - Database recovery procedures
