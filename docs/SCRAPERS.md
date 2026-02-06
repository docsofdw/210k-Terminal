# Portfolio Company Scrapers

This document describes the automated scrapers used to collect share structure data from portfolio companies. Each company has unique data sources with specific nuances that require custom parsing logic.

## Overview

The scraper system extracts capital structure data (shares outstanding, dilutive securities) from various sources:

| Company | Ticker | Source Type | Status | Notes |
|---------|--------|-------------|--------|-------|
| Strategy | MSTR | Browser (JS) | **Enabled** | Best-in-class disclosure |
| LQWD Technologies | LQWD.V | Browser (JS) | **Enabled** | Treasury dashboard |
| Oranje BTC | OBTC3 | Browser (JS) | **Enabled** | Brazilian dashboard |
| Metaplanet | 3350.T | Browser (JS) | **Enabled** | Analytics page |
| Smarter Web Co | SWC.AQ | HTML | **Enabled** | Static HTML page |
| Moon Inc | 1723.HK | PDF | **Enabled** | HKEX monthly filing |
| Capital B | ALCPB.PA | PDF | **Disabled** | Requires PDF parser |

## Scraper Types

### 1. HTML Scrapers (`fetchPage`)
Simple HTTP fetch with regex parsing. Works for static HTML pages.

### 2. Browser Scrapers (Puppeteer)
Headless Chrome for JavaScript-rendered pages. Uses `@sparticuz/chromium` for Vercel deployment.

### 3. PDF Parsers
Extract data from regulatory filings using `pdf-parse`.

---

## Company-Specific Documentation

### Strategy (MSTR)

**Source:** https://www.strategy.com/shares

**Scraper:** `lib/scrapers/strategy-scraper.ts`

**Data Quality:** Excellent - Strategy maintains the gold standard for BTC treasury disclosure.

**Page Structure:**
- Data displayed in a multi-column table by date
- All numbers shown in **thousands** (multiply by 1,000)
- Footnote references (e.g., `(2)`, `(3)`) identify specific rows

**Extracted Fields:**
| Field | Pattern | Notes |
|-------|---------|-------|
| Basic Shares Outstanding | `Basic Shares Outstanding (2)` | Class A + Class B |
| Assumed Diluted Shares | `Assumed Diluted Shares Outstanding (3)` | Includes all converts |
| Class A Shares | `Class A` | Common voting shares |
| Class B Shares | `Class B` | 10:1 voting rights |
| Convertible Notes | `YYYY Convert Shares @$XX.XX` | Multiple tranches |
| STRK Preferred | `STRK Convert Shares @$1,000.00` | Perpetual preferred |
| Options | `Options Outstanding` | Employee options |
| RSUs/PSUs | `RSU/PSU Unvested` | Restricted stock units |
| BTC Holdings | `Total BTC` | **Not** in thousands |

**Nuances:**
1. The page shows historical columns - always extract the **rightmost** (most recent) value
2. Dashes (`-`) indicate zero or N/A for that period
3. Convertible notes have multiple tranches with different strike prices
4. Last updated timestamp available in page header

**Dilution Calculation:**
```
Diluted = Basic + All Converts + STRK + Options + RSUs
```

---

### LQWD Technologies (LQWD.V)

**Source:** https://treasury.lqwdtech.com/?tab=shares

**Scraper:** `lib/scrapers/browser-scraper.ts` → `scrapeLQWD()`

**Data Quality:** Good - Company maintains a treasury dashboard similar to Strategy.

**Page Structure:**
- JavaScript-rendered dashboard
- Shows Basic Shares, Diluted Shares, and breakdown
- Uses arrow notation (`↳`) for sub-categories

**Extracted Fields:**
| Field | Pattern | Notes |
|-------|---------|-------|
| Basic Shares Outstanding | `Basic Shares Outstanding` followed by number | First number after label |
| Diluted Shares | `Diluted Shares Outstanding` | Includes warrants |
| Other (Warrants) | `↳ Other` | Warrants, options, etc. |

**Nuances:**
1. Wait 5+ seconds for JavaScript to fully render
2. "Other" category aggregates all dilutive securities
3. Dashboard updated periodically, not real-time

---

### Oranje BTC (OBTC3)

**Source:** https://www.oranjebtc.com/dashboard

**Scraper:** `lib/scrapers/browser-scraper.ts` → `scrapeOranje()`

**Data Quality:** Moderate - Dashboard shows market data but not detailed share structure.

**Page Structure:**
- Brazilian Portuguese interface
- Shows Market Cap and Share Price
- **Does not directly show shares outstanding**

**Extracted Fields:**
| Field | Pattern | Notes |
|-------|---------|-------|
| Market Cap | `VALOR DE MERCADO` followed by `R$ X.XXX.XXX` | Brazilian format |
| Share Price | `PREÇO OBTC3` followed by `R$ X,XX` | Brazilian format |

**Calculation:**
```
Shares Outstanding = Market Cap / Share Price
```

**Nuances:**
1. **Brazilian number format**: periods for thousands (`1.000.000`), comma for decimals (`6,50`)
2. Must convert: `1.009.713.250` → `1009713250`, `6,50` → `6.50`
3. Calculated shares = basic only, **no dilution data available**
4. Dashboard is in Portuguese - labels must match exactly

**Limitations:**
- No diluted share count (warrants, options not disclosed on dashboard)
- Relies on real-time price data accuracy

---

### Metaplanet (3350.T)

**Source:** https://metaplanet.jp/en/analytics

**Scraper:** `lib/scrapers/browser-scraper.ts` → `scrapeMetaplanet()`

**Data Quality:** Good - Analytics page shows key metrics but single share count only.

**Page Structure:**
- JavaScript-rendered analytics dashboard
- Values appear on line **before** their labels
- Some values use B/M/K suffixes (e.g., `1.14B`)
- May have blank lines between value and label

**Extracted Fields:**
| Field | Pattern | Notes |
|-------|---------|-------|
| Shares Outstanding | Number before `Shares Outstanding` label | e.g., `1.14B` |
| BTC Holdings | `₿XX,XXX` before `BTC Holdings` label | Integer BTC |
| Market Cap | `$X.XXB` before `Market Cap` label | USD value |
| mNAV | Number before `mNAV` label | Multiple of NAV |

**Nuances:**
1. **Value-before-label pattern**: The page displays values above their labels
2. Must skip blank lines when looking for values (up to 3 lines back)
3. Parse B/M/K suffixes: `1.14B` → `1,140,000,000`
4. Scroll page to load all content
5. Wait 8+ seconds for full JavaScript render

**Stock Split History:**
- 10:1 split in October 2024
- Current share count ~1.14B reflects post-split

**Limitations:**
- Analytics page shows **one** share count (doesn't differentiate basic vs diluted)
- For fully diluted shares including warrants, need to parse quarterly reports (PDFs)
- Warrant data available in disclosure documents but not on analytics page

**Alternative Sources (for future PDF parsing):**
- Quarterly Securities Report (四半期報告書)
- Monthly shareholder disclosures at `metaplanet.jp/en/shareholders/disclosures`

---

### Smarter Web Company (SWC.AQ)

**Source:** https://www.smarterwebcompany.co.uk/shareholders/equity-snapshot/

**Scraper:** `lib/scrapers/swc-scraper.ts`

**Data Quality:** Excellent - Static HTML page with clear structure.

**Page Structure:**
- Static HTML (no JavaScript required)
- Numbers wrapped in `<strong>` tags
- Clear labels for each security type

**Extracted Fields:**
| Field | Pattern | Notes |
|-------|---------|-------|
| Shares in Issue | `<strong>XXX,XXX</strong> shares in issue` | Basic shares |
| Pre-IPO Warrants | `<strong>XXX,XXX</strong> pre-IPO warrants` | Legacy warrants |
| Placing Warrants | `<strong>XXX,XXX</strong> placing warrants` | Fundraise warrants |
| Convertible Shares | `<strong>XXX,XXX</strong> shares to be potentially issued` | Converts |

**Dilution Calculation:**
```
Diluted = Shares in Issue + Pre-IPO Warrants + Placing Warrants + Convertible Shares
```

**Nuances:**
1. May include `&nbsp;` between number and label
2. "Last Updated" date sometimes available
3. Simple HTTP fetch works - no browser needed

---

### Moon Inc (1723.HK)

**Source:** https://portal.mooninc.hk/investor-relations/announcements

**Scraper:** `lib/scrapers/moon-inc-scraper.ts`

**Data Quality:** Excellent - HKEX regulatory filing with standardized format.

**Document Type:** FF301 "Monthly Return for Equity Issuer"

**Publication Schedule:** 3rd of each month

**PDF Structure:**
```
Section II: Movements in Issued Shares and/or Treasury Shares
  - Balance at close of the month → Shares Outstanding

Section III(A): Share Options → Usually "Not applicable"
Section III(B): Warrants → Usually "Not applicable"
Section III(C): Convertible Securities → Convertible Notes details
```

**Extracted Fields:**
| Field | Location | Notes |
|-------|----------|-------|
| Shares Outstanding | Section II, "Balance at close" | Excludes treasury |
| Convertible Shares | Section III(C) | Last column = potential shares |
| Report Month | Header | "For the month ended: DD Month YYYY" |

**Nuances:**
1. PDF text extraction can be messy - multiple regex patterns as fallbacks
2. Authorized shares (10B) should not be confused with issued shares
3. Convertibles table format: `Principal | Issued | Shares to be issued`
4. Moon Inc typically has no options/warrants ("Not applicable")

**PDF Parsing Patterns:**
```typescript
// Primary pattern for shares
/Movements\s+in\s+Issued\s+Shares[\s\S]{0,1000}?Balance\s+at\s+close[\s\S]{0,100}?([\d,]+)/i

// Fallback for public float section
/Public\s+float[\s\S]{0,300}?([\d,]{6,12})\s*0\s*\1/i
```

---

### Capital B (ALCPB.PA)

**Source:** Half-yearly and annual reports from Euronext Paris

**Scraper:** `lib/scrapers/browser-scraper.ts` → `scrapeCapitalB()` (DISABLED)

**Status:** Dashboard scraper disabled - analytics page doesn't expose share data.

**Data Quality:** Excellent in filings, but requires PDF parsing.

**Current State:**
The `cptlb.com/analytics/` dashboard does not display share structure data. Capital B publishes comprehensive data in their semi-annual reports.

**PDF Document:** Half-Year Report (available in `/docs/build_process/pdf-examples/Capital-B-HY.pdf`)

**Key Sections for Parsing:**

**Note 5.9 - Share Capital:**
| Field | Value (June 2025) | Notes |
|-------|-------------------|-------|
| Basic Shares | 135,261,118 | Issued ordinary shares |
| Treasury Shares | 86,449 | Held by company |
| BSA (Warrants) | 59,218,569 | Converts to ~8.5M shares |
| Free Shares (AGA) | 500,000 | Employee grants |

**Note 5.10 - Convertible Bonds (OCA):**
Multiple tranches with different conversion prices:
```
OCA 2023: 12,305,155 bonds @ variable price
OCA Dec 2024: 14,125,000 bonds @ €1.265
OCA Feb 2025: Various tranches
...etc
Total: 123,612,559 bonds outstanding
```

**BTC Holdings:** 1,788 BTC (as of June 30, 2025)

**Parsing Complexity:**
- French language document
- Multiple OCA tranches with different terms
- Conversion ratios vary by tranche
- Some bonds have caps or floors on conversion

**Next Steps:**
Build PDF parser targeting Notes 5.9 and 5.10 in Half-Year Report format.

---

## File Structure

```
lib/scrapers/
├── base.ts              # Shared utilities (fetchPage, parseNumber, validation)
├── index.ts             # Scraper registry and runAllScrapers()
├── swc-scraper.ts       # SWC.AQ HTML scraper
├── moon-inc-scraper.ts  # 1723.HK PDF parser
├── strategy-scraper.ts  # MSTR browser scraper
└── browser-scraper.ts   # LQWD, Capital B, Oranje, Metaplanet scrapers

docs/build_process/pdf-examples/
├── README.md
├── Moon-inc-monthly-return.pdf
├── Capital-B-HY.pdf
└── MTPFL-Share-Issuance.pdf
```

## Running Scrapers

### Test Individual Scrapers
```bash
# Test all scrapers (HTML + PDF only)
npx tsx scripts/test-scraper.ts

# Test all scrapers including browser-based
npx tsx scripts/test-scraper.ts --browser
```

### Run All Enabled Scrapers
```typescript
import { runAllScrapers, closeBrowser } from './lib/scrapers'

const results = await runAllScrapers()
await closeBrowser()
```

## Adding New Scrapers

1. Create scraper file in `lib/scrapers/`
2. Export scraper function and ticker constant
3. Add to `SCRAPER_REGISTRY` in `index.ts`
4. Document in this file with:
   - Source URL
   - Page structure description
   - Extracted fields table
   - Nuances and edge cases
   - Any calculation logic

## Common Issues

### Browser Scrapers
- **Timeout**: Increase wait time for slow-loading pages
- **Selector not found**: Page structure may have changed
- **Memory issues**: Close browser after each run in serverless

### PDF Parsers
- **Text extraction fails**: PDF may use images instead of text
- **Wrong number extracted**: Add more specific regex patterns
- **Encoding issues**: Some PDFs use non-standard character encodings

### Number Parsing
- **Locale differences**: Brazilian (`.` for thousands), European (`,` for decimals)
- **Suffixes**: B/M/K need multiplication
- **Currency symbols**: Strip $, €, £, ¥, ₿, R$ before parsing
