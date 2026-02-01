# Data Quality Issues & Strategy

## Executive Summary

Our current API-based approach for market data has critical limitations for Bitcoin treasury companies. The core problem: **these companies dilute frequently through convertible notes, ATM offerings, and other instruments that standard financial APIs don't track**.

---

## Current Issues

### 1. Diluted Shares Are Inaccurate from APIs

**Example: Strategy (MSTR) as of 01/25/2026**

| Source | Shares Reported | Actual |
|--------|-----------------|--------|
| Yahoo Finance | 287.1M | ❌ Wrong |
| Twelve Data | 287.1M | ❌ Wrong |
| Company (Basic) | 331.7M | ✓ Correct |
| Company (Diluted) | 364.2M | ✓ Correct |

**Why APIs are wrong:**
- APIs miss ~43M shares from recent issuances (even for basic shares)
- APIs completely miss ~77M shares from convertible notes:
  - 2028 Convert: 5.5M
  - 2029 Convert: 4.5M
  - 2030 A Convert: 5.3M
  - 2030 B Convert: 4.6M
  - 2031 Convert: 2.6M
  - 2032 Convert: 3.9M
  - STRK Convert: 1.4M
  - Options/RSUs: 4.6M

**Impact:** D.mNAV calculations are significantly wrong when using API data.

### 2. BTC Holdings Not Available via APIs

- No financial API tracks Bitcoin holdings
- Only the companies themselves report this data
- Holdings change with every purchase announcement

### 3. Capital Structure Complexity

Each company has unique instruments:
- Convertible notes (various strike prices/dates)
- Warrants
- Options/RSUs
- Preferred stock
- ATM offerings (ongoing dilution)

### 4. Data Staleness

- SEC filings have quarterly lag
- API providers update inconsistently
- Companies announce BTC purchases immediately but holdings data lags

---

## What APIs Are Good For vs. Bad For

### ✅ APIs Work Well For:
- Real-time stock prices
- Basic market data (volume, 52-week high/low)
- Price history for charts

### ❌ APIs Are Unreliable For:
- Diluted shares outstanding
- BTC holdings
- Cash/debt positions
- Convertible note details
- Recent share issuances

---

## Company Data Sources

### Treasury Dashboards (BTC Holdings, Metrics)

| Company | Dashboard URL |
|---------|---------------|
| LQWD Technologies | https://treasury.lqwdtech.com/ |
| Strategy (MSTR) | https://www.strategy.com/ |
| Nakamoto Holdings | https://nakamoto.com/dashboard |
| H100 Group | https://treasury.h100.group/ |
| Matador | https://www.matador.network/ |
| Capital B | https://cptlb.com/analytics/ |
| Metaplanet | https://metaplanet.jp/en/analytics |
| Aifinyo | https://www.aifinyo.de/ |
| Bit Planet | https://bit-planet.kr/ |
| Oranje BTC | https://www.oranjebtc.com/dashboard |
| Treasury BTC | https://www.treasury-btc.com/ |
| Smarter Web Company | https://www.smarterwebcompany.co.uk/bitcoin-treasury/analytics-/ |

### Investor Relations (Shares Data)

| Company | IR/Shares URL |
|---------|---------------|
| Capital B | https://cptlb.com/investors/news-financial-information/ |
| Strategy | https://www.strategy.com/shares |
| Metaplanet | https://metaplanet.jp/en/shareholders/disclosures |
| Smarter Web Company | https://investors.smarterwebcompany.co.uk/investors/equity-snapshot/ |
| LQWD Technologies | https://lqwdtech.com/investors/ |
| Matador | https://www.matador.network/press-releases |
| DigitalX | https://investorhub.digitalx.com/announcements |
| LQWD (Shares Tab) | https://treasury.lqwdtech.com/?tab=shares |

---

## Current Scraping Approach

We have a Google Apps Script that scrapes bitcointreasuries.net:

**What it captures:**
- Rank
- Company name
- Ticker (with custom mappings for international exchanges)
- Bitcoin holdings

**Limitations:**
- No diluted shares data
- No cash/debt data
- Dependent on bitcointreasuries.net accuracy
- Single point of failure

**Ticker Mappings Handled:**
```
MTPLF → 3350.T (Metaplanet)
H100 → GS9.F
LQWD → LQWD.V
SWC → SWC.AQ
... (40+ mappings)
```

---

## Options Analysis

### Option 1: Keep Current Hybrid (Google Sheets + APIs)

**How it works:**
- APIs → Prices only (every 15 min)
- Google Sheets → Fundamentals (BTC, diluted shares, cash, debt)
- Manual updates when companies announce

**Pros:**
- Already working
- Most accurate diluted shares
- Human verification of data

**Cons:**
- Manual effort to maintain
- Can fall behind on rapid dilution events
- Single person dependency

### Option 2: Build Company-Specific Scrapers

**How it works:**
- Custom scraper for each company's IR page
- Automated extraction of shares, holdings, etc.

**Pros:**
- Automated data collection
- Near real-time updates possible

**Cons:**
- High build effort (12+ unique scrapers)
- Maintenance nightmare when sites change
- Different page structures per company
- Some sites may block scraping
- International sites (Japanese, Korean) add complexity

### Option 3: Enhanced Hybrid with Selective Scraping

**How it works:**
- APIs → Prices (current approach)
- bitcointreasuries.net scraper → BTC holdings (current approach)
- Company dashboard scrapers → Only for companies with structured dashboards
- Google Sheets → Fallback for complex capital structures

**Target for scraping (structured dashboards):**
- Strategy (has clear /shares page)
- Metaplanet (has analytics page)
- LQWD (has treasury dashboard with tabs)
- Capital B (has analytics page)

**Keep manual for:**
- Companies without dashboards
- Complex capital structures
- International filings

**Pros:**
- Best accuracy where automation is feasible
- Reduced manual effort for well-structured sources
- Fallback for edge cases

**Cons:**
- Still requires some manual maintenance
- Partial automation may create inconsistency

### Option 4: Data Provider Partnership

**How it works:**
- Partner with a specialized Bitcoin treasury data provider
- Or use premium financial data APIs (Bloomberg, Refinitiv)

**Pros:**
- Professional-grade data
- Someone else maintains accuracy

**Cons:**
- Expensive (Bloomberg Terminal ~$24k/year)
- May still not capture all treasury-specific metrics
- Dependency on third party

### Option 5: Community/Crowdsourced Updates

**How it works:**
- Build a submission system for companies to self-report
- Or integrate with community-maintained databases

**Pros:**
- Companies have incentive to report accurately
- Scales with community

**Cons:**
- Requires adoption
- Verification challenges
- Build effort for submission system

---

## Recommendation

**Short-term (Now):** Enhanced Hybrid (Option 3)

1. **Keep APIs for prices** - They work well for this
2. **Keep bitcointreasuries.net scraper** - Good for BTC holdings baseline
3. **Build scrapers for top 5 companies with structured dashboards:**
   - Strategy (/shares page is well-structured)
   - Metaplanet (analytics page)
   - LQWD (treasury dashboard)
   - Capital B (analytics page)
   - Nakamoto (dashboard)
4. **Google Sheets remains source of truth for diluted shares** - Import via API

**Long-term:** Consider building a company self-reporting portal if user base grows.

---

## Priority Data Fields

| Field | Source Recommendation | Update Frequency |
|-------|----------------------|------------------|
| Stock Price | APIs (Twelve Data/Yahoo) | Every 15 min |
| BTC Price | APIs (CoinGecko) | Every 1 min |
| BTC Holdings | Scraper + Manual | On announcement |
| Basic Shares | Google Sheets | Weekly |
| Diluted Shares | Google Sheets | Weekly |
| Cash | Google Sheets | Quarterly |
| Debt | Google Sheets | Quarterly |
| Convertible Details | Google Sheets | On issuance |

---

## Next Steps

1. [ ] Audit current Google Sheets data for all companies
2. [ ] Identify which companies have scrapable dashboards
3. [ ] Build prototype scraper for Strategy /shares page
4. [ ] Create alerting for when API data diverges significantly from Sheets
5. [ ] Document manual update process for each company
6. [ ] Consider webhook/RSS monitoring for company announcements

---

## Appendix: Current Scraper Code

The existing bitcointreasuries.net scraper is a Google Apps Script that:
- Fetches HTML from bitcointreasuries.net
- Parses table rows for rank, name, ticker, BTC holdings
- Applies ticker mappings for international exchanges
- Writes to Google Sheets
- Can run on daily trigger

See the full script in the project repository or Google Apps Script editor.
