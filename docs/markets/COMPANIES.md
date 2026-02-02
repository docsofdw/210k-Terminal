# Company Data Source

> **Note:** As of January 2026, company data is sourced from the BTCTCs Master Google Sheet which tracks ~100 Bitcoin treasury companies. See [COMPS_TABLE.md](./COMPS_TABLE.md) for detailed documentation.

## Current Data Source

### BTCTCs Master Sheet

| Setting | Value |
|---------|-------|
| Companies Tracked | ~100 |
| Data Source | External Google Sheet |
| Sync Frequency | Every 4 hours |
| Spreadsheet ID | `1_whntepzncCFsn-K1oyL5Epqh5D6mauAOnb_Zs7svkk` |
| Sheet Tab | `Dashboard` |

### Company Categories

Companies are categorized into:

| Category | Description |
|----------|-------------|
| Treasury Company | Pure-play Bitcoin treasury companies (e.g., Strategy, CEPO) |
| Miner | Bitcoin mining companies with BTC holdings (e.g., MARA, RIOT) |
| Other | Companies with Bitcoin on balance sheet (e.g., Tesla, Block) |

### Regions

| Region | Examples |
|--------|----------|
| North America | Strategy, MARA, Tesla, Coinbase |
| Asia | Metaplanet (Japan), Boyaa (Hong Kong) |
| Europe | Bitcoin Group SE (Germany), Aker ASA (Norway) |
| South America | OranjeBTC (Brazil), Méliuz (Brazil) |

---

## Sync Process

### Automatic Sync

Data syncs automatically every 4 hours via the `/api/cron/sync-sheets` endpoint.

**Schedule:** `0 */4 * * *` (12 AM, 4 AM, 8 AM, 12 PM, 4 PM, 8 PM UTC)

### Manual Sync

```bash
# Run the sync script
npx tsx db/seed/sync-from-sheets.ts
```

### Sync Requirements

1. Google Sheet must be shared with the service account:
   ```
   id-10k-terminal-sheet@k-terminal-485321.iam.gserviceaccount.com
   ```

2. Environment variable must be set:
   ```bash
   GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
   ```

---

## Key Companies (Top 20 by BTC Holdings)

| Rank | Company | Ticker | BTC Holdings | Category |
|------|---------|--------|--------------|----------|
| 1 | Strategy | MSTR | 712,647 | Treasury Company |
| 2 | MARA Holdings | MARA | 53,250 | Miner |
| 3 | Twenty One Capital | XXI | 43,514 | Other |
| 4 | Metaplanet Inc. | 3350.T | 35,102 | Treasury Company |
| 5 | Bitcoin Standard Treasury | CEPO | 30,021 | Treasury Company |
| 6 | Bullish | BLSH | 24,300 | Other |
| 7 | Riot Platforms | RIOT | 18,005 | Miner |
| 8 | Coinbase Global | COIN | 14,548 | Other |
| 9 | Hut 8 Mining Corp | HUT | 13,696 | Miner |
| 10 | Strive | ASST | 13,132 | Other |
| 11 | CleanSpark | CLSK | 13,099 | Miner |
| 12 | Trump Media | DJT | 11,542 | Other |
| 13 | Tesla | TSLA | 11,509 | Other |
| 14 | Block | XYZ | 8,780 | Other |
| 15 | Cango Inc | CANG | 7,874 | Other |
| 16 | GD Culture Group | GDC | 7,500 | Other |
| 17 | Galaxy Digital | GLXY | 6,894 | Other |
| 18 | American Bitcoin Corp | ABTC | 5,843 | Treasury Company |
| 19 | Next Technology | NXTT | 5,833 | Other |
| 20 | Nakamoto Inc | NAKA | 5,398 | Other |

*Data as of last sync. See live data at `/dashboard/comps`.*

---

## Legacy: Original 15 Companies

The platform originally launched with 15 manually-tracked companies. These are now included in the larger ~100 company dataset:

| Original Company | Current Status |
|------------------|----------------|
| American Bitcoin Corp. (ABTC) | Included |
| Bitcoin Treasury Corp. (BTCT.V) | Included |
| Oranje S.A. (OBTC3.SA) | Included |
| DigitalX (DCC.AX) | Included |
| Metaplanet (3350.T) | Included |
| The Smarter Web Co. (SWC.AQ) | Included |
| Capital B (ALCPB.PA) | Included |
| Satsuma Technology (SATS.L) | Included |
| Bitplanet (049470.KQ) | Included |
| LQWD Technologies (LQWD.V) | Included |
| Treasury BV (TRSR) | Included |

---

## Related Documentation

- [Comps Table](./COMPS_TABLE.md) - Full comps table documentation
- [Data Model](./DATA_MODEL.md) - Database schema
- [API Integrations](./API_INTEGRATIONS.md) - External APIs
