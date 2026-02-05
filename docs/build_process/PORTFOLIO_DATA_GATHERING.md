# Portfolio Company Data Gathering Strategy

This document outlines a systematized approach for gathering high-quality financial data (Shares Outstanding, Diluted Shares, Total Debt, Cash & Equivalents) for 210k Capital portfolio companies.

---

## Core Principle: Tiered Data Quality

**Portfolio companies require higher data quality than non-portfolio companies.** For non-portfolio companies, existing APIs and bitcointreasuries.net scraping are sufficient. For portfolio companies, we need direct-from-source verification.

---

## Portfolio Company Data Source Matrix

| Company | Ticker | Data Source | Automation Tier | Update Frequency | Notes |
|---------|--------|-------------|-----------------|------------------|-------|
| **Strategy** | MSTR | https://www.strategy.com/shares | Tier 1 (Scrapeable) | On announcement | Well-structured JSON/HTML |
| **Metaplanet** | 3350.T | https://metaplanet.jp/en/shareholders/disclosures | Tier 2 (Filings) | Quarterly + announcements | PDF filings, Japanese IR |
| **Smarter Web** | SWC.AQ | https://www.smarterwebcompany.co.uk/shareholders/equity-snapshot/ | Tier 1 (Scrapeable) | Monthly | Very structured page |
| **Moon Inc** | 1723.HK | https://portal.mooninc.hk/investor-relations/announcements | Tier 3 (Scheduled) | 3rd of each month | "Monthly return for equity" PDF |
| **LQWD** | LQWD.V | https://treasury.lqwdtech.com/?tab=shares | Tier 1 (Scrapeable) | Real-time dashboard | Excellent structured data |
| **Capital B** | ALCPB.PA | https://cptlb.com/analytics/ | Tier 1 (Scrapeable) | Real-time dashboard | Also: filings at /investors/ |
| **Oranje** | OBTC3 | https://www.oranjebtc.com/dashboard | Tier 1 (Scrapeable) | Real-time dashboard | Structured dashboard |
| **Treasury BV** | TRSR | N/A | Tier 4 (Manual) | N/A | Pre-trading, use entry mNAV |
| **DV8** | DV8.BK | Thai SEC filings / Yahoo | Tier 4 (Manual) | Quarterly | No BTC, but need shares for portfolio value |

---

## Automation Tiers Explained

### Tier 1: Fully Scrapeable Dashboards
**Companies:** Strategy, Smarter Web, LQWD, Capital B, Oranje

These companies have structured web dashboards where data can be extracted programmatically.

**Implementation:**
- Build dedicated scraper endpoints per company
- Run on schedule or triggered by webhook/RSS
- Validate data against expected ranges before writing to DB
- Store raw scraped data for audit trail

**Example - Smarter Web Company:**
```
URL: https://www.smarterwebcompany.co.uk/shareholders/equity-snapshot/

Data available:
- "Shares in Issue" = Shares Outstanding
- Sum of (Options + Warrants + Convertibles) = Additional dilutive shares
- Diluted Shares = Shares in Issue + Dilutive instruments
```

### Tier 2: Filing-Based with Structured Landing Pages
**Companies:** Metaplanet, Capital B (backup)

Companies that primarily report through filings but have structured landing pages listing recent documents.

**Implementation:**
- Monitor filing landing page for new documents
- Extract filing date and type
- For PDF filings: Download and store, flag for manual extraction OR use PDF parsing
- Semi-automated: Scraper detects new filing, admin extracts key numbers

### Tier 3: Calendar-Based Filing Schedule
**Companies:** Moon Inc

Companies with predictable filing schedules where we know exactly when and what to look for.

**Implementation:**
- Calendar trigger (e.g., 3rd of each month for Moon Inc)
- Automated check for "Monthly Return for Equity" document
- Parse or flag for manual review
- Slack/Telegram alert: "Moon Inc monthly return published - needs review"

### Tier 4: Manual Only
**Companies:** Treasury BV, DV8

Companies without reliable automated sources.

**Implementation:**
- Admin panel for manual data entry
- Clear "last updated" and "source" fields
- Optional: Quarterly reminder alerts to update

---

## Data Fields & Extraction Strategy Per Company

### 1. Strategy (MSTR)
**Source:** https://www.strategy.com/shares

| Field | Location | Format |
|-------|----------|--------|
| Shares Outstanding (Basic) | /shares page, "Class A Common Stock" | Number |
| Diluted Shares | /shares page, total after converts | Number (sum all instruments) |
| Convertible Details | /shares page, breakdown by tranche | Table with strike prices, shares |
| Cash | Latest 8-K/10-Q | USD |
| Debt | /shares page or 8-K | USD |

**Dilution Calculation:**
- Class A shares outstanding
- PLUS: 2028 Convert shares
- PLUS: 2029 Convert shares
- PLUS: 2030 A Convert shares
- PLUS: 2030 B Convert shares
- PLUS: 2031 Convert shares
- PLUS: 2032 Convert shares
- PLUS: STRK preferred (converted basis)
- PLUS: Options/RSUs

### 2. Smarter Web Company (SWC.AQ)
**Source:** https://www.smarterwebcompany.co.uk/shareholders/equity-snapshot/

| Field | Location | Format |
|-------|----------|--------|
| Shares Outstanding | "Shares in Issue" row | Number |
| Diluted Shares | Sum all rows | Number |
| Options/Warrants | Individual rows | Number |

**Note:** This is the easiest to scrape - clean HTML table with clear labels.

### 3. LQWD Technologies (LQWD.V)
**Source:** https://treasury.lqwdtech.com/?tab=shares

| Field | Location | Format |
|-------|----------|--------|
| Shares Outstanding | Shares tab | Number |
| Diluted Shares | Shares tab | Number |
| Warrants | Shares tab | Number with expiry dates |
| Options | Shares tab | Number |

**Note:** Excellent structured dashboard - API may be accessible.

### 4. Capital B (ALCPB.PA)
**Source:** https://cptlb.com/analytics/

| Field | Location | Format |
|-------|----------|--------|
| Basic Shares | Analytics page | Number |
| Diluted Shares | Analytics page | Number |
| Detailed breakdown | https://cptlb.com/investors/news-financial-information/ | Filings |

**Note:** Two sources - quick numbers from analytics, detailed from filings for verification.

### 5. Metaplanet (3350.T)
**Source:** https://metaplanet.jp/en/shareholders/disclosures

| Field | Location | Format |
|-------|----------|--------|
| Shares Outstanding | Latest disclosure PDF | Number |
| Diluted Shares | Latest disclosure PDF | Number |
| Warrants | Warrant exercise announcements | Number |

**Note:** Japanese company. Monitor English disclosures only at https://metaplanet.jp/en/shareholders/disclosures. Stock splits and warrant exercises are common - watch for announcements.

### 6. Moon Inc (1723.HK)
**Source:** https://portal.mooninc.hk/investor-relations/announcements

| Field | Location | Format |
|-------|----------|--------|
| Shares Outstanding | "Monthly Return for Equity" PDF | Number |
| Filing Date | 3rd business day of each month | Calendar |

**Note:** Hong Kong listed. Very predictable schedule.

**PDF Parsing Required:**
- Download "Monthly Return for Equity" PDF from announcements page
- Parse PDF to extract share count (likely tabular format)
- Implementation options:
  1. **pdf-parse** (Node.js) - Simple text extraction
  2. **pdf.js** - More control over structure
  3. **LLM extraction** - Send PDF text to Claude API for structured extraction
- Need sample PDF to determine best approach

### 7. Oranje (OBTC3)
**Source:** https://www.oranjebtc.com/dashboard

| Field | Location | Format |
|-------|----------|--------|
| Key metrics | Dashboard | JSON/HTML |

**Note:** BTC treasury dashboard exists - check if shares data is displayed.

### 8. Treasury BV (TRSR)
**Status:** Pre-trading (not yet live)

**Strategy:**
- Store entry mNAV and cost basis from investment
- Flag as "manual" data source
- Update when trading begins and filings become available

### 9. DV8 (DV8.BK)
**Status:** No BTC holdings - mNAV not applicable

| Field | Location | Format |
|-------|----------|--------|
| Shares Outstanding | Thai SEC filings or Yahoo Finance | Number |
| Diluted Shares | Thai SEC filings | Number |

**Note:** Still need share count for portfolio value calculation. No treasury metrics (mNAV, BTC NAV) needed. Quarterly manual update from Thai exchange filings or Yahoo Finance API for basic shares.

---

## Implementation Architecture

### Database Schema Additions

Consider adding these fields to track data provenance:

```typescript
// In companies schema, add:
sharesSource: text("shares_source"),           // "scraper:swc" | "manual" | "api:yahoo"
sharesLastVerified: timestamp("shares_last_verified"),
dilutionSource: text("dilution_source"),       // "scraper:mstr" | "manual"
dilutionLastVerified: timestamp("dilution_last_verified"),
capitalStructureNotes: text("capital_structure_notes"), // Free text for complex situations
```

### Scraper Infrastructure (Next.js Cron Jobs)

Scrapers run as Vercel cron endpoints, unified with existing cron infrastructure.

```
/lib/scrapers/
├── base-scraper.ts           # Common utilities (fetch, parse, validate)
├── strategy-scraper.ts       # MSTR /shares page
├── swc-scraper.ts            # Smarter Web equity snapshot
├── lqwd-scraper.ts           # LQWD treasury dashboard
├── capital-b-scraper.ts      # Capital B analytics
├── oranje-scraper.ts         # Oranje dashboard
├── metaplanet-scraper.ts     # Metaplanet EN disclosures
├── moon-inc-scraper.ts       # Moon Inc PDF parser
└── index.ts                  # Scraper registry

/app/api/cron/
├── scrape-portfolio-fundamentals/
│   └── route.ts              # Weekly: runs all Tier 1 scrapers
├── scrape-moon-inc/
│   └── route.ts              # Monthly (3rd): Moon Inc PDF parse
```

**vercel.json cron config:**
```json
{
  "crons": [
    {
      "path": "/api/cron/scrape-portfolio-fundamentals",
      "schedule": "0 6 * * 1"
    },
    {
      "path": "/api/cron/scrape-moon-inc",
      "schedule": "0 6 3 * *"
    }
  ]
}
```

### Validation Rules

Before writing scraped data:

1. **Range check:** Shares should be > 0 and < 10B (reasonable bounds)
2. **Change threshold:** Alert if value changes > 50% from previous (likely error)
3. **Comparison:** Cross-check basic shares ≤ diluted shares
4. **Staleness:** Flag if data older than thresholds (quarterly for filings, monthly for dashboards)

### Admin Dashboard Features

For Tier 4 (manual) companies:

1. **Manual Entry Form**
   - Shares Outstanding input
   - Diluted Shares input
   - Debt input
   - Cash input
   - Source URL (required)
   - Notes field

2. **Data Freshness Indicators**
   - Green: Updated within expected window
   - Yellow: Approaching stale threshold
   - Red: Overdue for update

3. **Change Log**
   - Track who changed what, when, with source

---

## Update Schedule

| Company | Frequency | Trigger | Cron Schedule |
|---------|-----------|---------|---------------|
| Strategy | Weekly | Cron job | `0 6 * * 1` (Mon 6am UTC) |
| Metaplanet | Weekly | Cron job (EN disclosures) | `0 6 * * 1` |
| Smarter Web | Weekly | Cron job | `0 6 * * 1` |
| Moon Inc | Monthly | 3rd of month + PDF parse | `0 6 3 * *` |
| LQWD | Weekly | Cron job | `0 6 * * 1` |
| Capital B | Weekly | Cron job | `0 6 * * 1` |
| Oranje | Weekly | Cron job | `0 6 * * 1` |
| Treasury BV | Manual | On material change | N/A |
| DV8 | Quarterly | Manual | N/A |

**Note:** All Tier 1 scrapers run weekly on Monday 6am UTC to catch weekend announcements.

---

## Alert System Integration

Integrate with existing alert system for:

1. **Scraper Failure Alerts**
   - If scraper fails 2x in a row → Slack/Telegram alert to admin

2. **Data Quality Alerts**
   - If scraped value fails validation → Flag for manual review

3. **Filing Reminders**
   - Moon Inc: "Check for monthly return" on 3rd of month
   - Quarterly filings: Reminder 2 weeks after quarter end

4. **Staleness Alerts**
   - If portfolio company data > X days old → Alert

---

## Implementation Status

### ✅ Completed Scrapers (Working)

| Company | Ticker | Scraper | Test Results |
|---------|--------|---------|--------------|
| **Strategy** | MSTR | `strategy-scraper.ts` | ✓ 332.4M / 364.8M diluted. Extracts Class A/B, 8 convert tranches, STRK, options, RSUs, BTC |
| **Smarter Web** | SWC.AQ | `swc-scraper.ts` | ✓ 350.2M / 463.7M diluted. Pre-IPO warrants, placing warrants, convertibles |
| **Moon Inc** | 1723.HK | `moon-inc-scraper.ts` | ✓ 478.3M / 488.7M diluted. PDF parser for HKEX FF301 monthly return |
| **LQWD** | LQWD.V | `browser-scraper.ts` | ✓ 31.9M / 42.7M diluted. Puppeteer for JS-rendered dashboard |
| **Oranje** | OBTC3 | `browser-scraper.ts` | ✓ 155.3M calculated from market cap / price |

### ⚠️ Needs Alternative Approach

| Company | Ticker | Issue | Recommended Alternative |
|---------|--------|-------|------------------------|
| **Capital B** | ALCPB.PA | Dashboard at cptlb.com/analytics doesn't expose share data | Parse filings at cptlb.com/investors/ OR manual from quarterly reports |
| **Metaplanet** | 3350.T | Disclosures page links to PDFs, no structured data | Build PDF parser for disclosure documents (similar to Moon Inc) |

### 📝 Manual Entry Required

| Company | Ticker | Reason | Update Frequency |
|---------|--------|--------|------------------|
| **Treasury BV** | TRSR | Pre-trading, no public data | On trading commencement |
| **DV8** | DV8.BK | Thai SEC filings (not scraped) | Quarterly from Thai exchange filings |

### Infrastructure Built

- **Base utilities:** `lib/scrapers/base.ts` - parseNumber, validateSharesData, fetchPage
- **Scraper registry:** `lib/scrapers/index.ts` - centralized config for all scrapers
- **Browser automation:** `lib/scrapers/browser-scraper.ts` - Puppeteer + @sparticuz/chromium for serverless
- **Cron endpoint:** `app/api/cron/scrape-portfolio-fundamentals/route.ts`
- **Telegram notifications:** Functions in `lib/notifications/telegram.ts`
- **Test script:** `scripts/test-scraper.ts` - run with `--browser` flag
- **Schema:** Data provenance fields added to companies table

### Cron Configuration (vercel.json)

```json
{
  "crons": [
    { "path": "/api/cron/scrape-portfolio-fundamentals", "schedule": "0 6 * * 1" }
  ]
}
```

---

## Phase 1 Implementation Plan

### Week 1: Foundation ✅
- [x] Add data provenance fields to schema
- [x] Create base scraper utilities
- [x] Build SWC scraper (simplest, proof of concept)

### Week 2: Core Scrapers ✅
- [x] Build LQWD scraper
- [x] Build Capital B scraper (dashboard doesn't work - needs alternative)
- [x] Build Strategy scraper (most complex - includes all converts, STRK, options, RSUs)

### Week 3: Remaining Scrapers ✅
- [x] Build Oranje scraper (calculates from market cap/price)
- [x] Build Metaplanet filing monitor (dashboard doesn't expose data - needs PDF parser)
- [x] Build Moon Inc PDF parser

### Week 4: Integration (In Progress)
- [x] Create cron job for portfolio fundamentals
- [ ] Build admin manual entry UI
- [ ] Add data freshness indicators to comps table
- [ ] Build Capital B filing parser
- [ ] Build Metaplanet PDF parser
- [ ] Deploy and monitor

---

## Non-Portfolio Company Strategy

For the ~90 other companies in the comps table:

**Continue using:**
1. Google Sheets sync (every 4 hours) for fundamentals
2. APIs for real-time prices
3. bitcointreasuries.net for BTC holdings baseline

**When adding a new portfolio company:**
1. Identify primary data source
2. Classify into appropriate Tier
3. Build scraper or document manual process
4. Add to cron schedule if automated
5. Set up appropriate alerts

---

## Decisions Made

| Question | Decision |
|----------|----------|
| **Metaplanet language** | English disclosures only (https://metaplanet.jp/en/) |
| **Scraper infrastructure** | Next.js cron jobs (Vercel) - unified with existing crons |
| **Tier 1 update frequency** | Weekly |
| **Moon Inc PDF** | Sample uploaded to `docs/build_process/pdf-examples/` |
| **Capital B** | Dashboard doesn't expose shares - use filings (disabled in registry) |
| **Metaplanet** | Disclosures page links to PDFs - needs PDF parser (disabled in registry) |

## Open Questions

1. **Treasury BV:** Trading timeline unknown - continue with entry mNAV until live
2. **Capital B:** Need to identify specific filing URL pattern for quarterly share reports
3. **Metaplanet:** Need sample PDF from disclosures page to build parser

## Completed

- **Schema updates:** Data provenance fields added to companies table (sharesSource, sharesLastVerified, dilutionSource, dilutionLastVerified, capitalStructureNotes)
- **Base scraper utilities:** `lib/scrapers/base.ts` with parseNumber, validateSharesData, fetchPage, formatSharesData
- **SWC scraper:** HTML scraper for Smarter Web equity snapshot page
- **Moon Inc PDF parsing:** HKEX FF301 form parser (pdf-parse v2). Extracts shares from Section II, convertibles from Section III(C)
- **LQWD scraper:** Puppeteer-based scraper for JS-rendered treasury dashboard
- **Oranje scraper:** Calculates shares from market cap / price displayed on dashboard
- **Strategy (MSTR) scraper:** Complex scraper extracting Class A/B shares, 8 convert tranches (2025-2032), STRK preferred, options, RSUs, BTC holdings from strategy.com/shares
- **Scraper registry:** Centralized config in `lib/scrapers/index.ts` with enabled/disabled flags
- **Cron endpoint:** Weekly scraper execution at `app/api/cron/scrape-portfolio-fundamentals/`
- **Telegram integration:** Scraper success/failure notifications via existing Telegram setup
- **Test script:** `scripts/test-scraper.ts` with `--browser` flag for Puppeteer scrapers

---

## Appendix: Current Data Quality Issues Reference

See [DATA_QUALITY_ISSUES.md](./DATA_QUALITY_ISSUES.md) for the broader context on why API data is unreliable for treasury companies.

Key insight: **APIs miss ~25-30% of dilutive instruments** for companies with active capital programs. For portfolio companies, this error margin is unacceptable.
