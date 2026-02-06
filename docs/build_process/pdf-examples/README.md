# PDF Examples for Scraper Development

This folder contains sample PDFs for developing document parsers.

## Current Samples

| File | Company | Document Type | Status |
|------|---------|---------------|--------|
| `Moon-inc-monthly-return.pdf` | Moon Inc (1723.HK) | HKEX FF301 Monthly Return | **Parser complete** |
| `Capital-B-HY.pdf` | Capital B (ALCPB.PA) | Half-Year Report | **Parser needed** |
| `MTPFL-Share-Issuance.pdf` | Metaplanet (3350.T) | Share Issuance Announcement | Not useful (single event) |

## Moon Inc Monthly Return

**Parser:** `lib/scrapers/moon-inc-scraper.ts`

HKEX regulatory filing (FF301 form) published on the 3rd of each month.

Key sections:
- **Section II**: Shares outstanding (balance at close of month)
- **Section III(C)**: Convertible notes details

## Capital B Half-Year Report

**Parser:** Needed - currently disabled in registry

French language semi-annual report with comprehensive capital structure.

Key sections to parse:
- **Note 5.9**: Share capital (basic shares, treasury, BSA warrants, free shares)
- **Note 5.10**: Convertible bonds (OCA) - multiple tranches with different terms

Data points (as of June 30, 2025):
- Basic shares: 135,261,118
- Treasury shares: 86,449
- BSA (warrants): 59,218,569 → ~8.5M potential shares
- OCA (convertible bonds): 123,612,559 bonds across multiple tranches
- BTC Holdings: 1,788 BTC

## Metaplanet Share Issuance

**Status:** Not useful for scraping

This PDF is a single issuance announcement, not a comprehensive capital structure document. For Metaplanet data, use the analytics page scraper instead (`scrapeMetaplanet()`).

For complete warrant/dilution data, would need:
- Quarterly Securities Report (四半期報告書)
- Annual Securities Report (有価証券報告書)

## Adding New PDFs

When adding a new PDF sample:
1. Add the PDF to this folder
2. Update this README with document structure details
3. Create parser in `/lib/scrapers/`
4. Document nuances in `/docs/SCRAPERS.md`
