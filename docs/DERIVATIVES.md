# Derivatives Dashboard

Dashboard for viewing Clear Street derivative positions with real-time Greeks enrichment and strategy simulation.

**Route:** `/dashboard/derivatives-positions`
**Nav:** Portfolio > Derivatives

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Derivatives Page                             │
├─────────────────────────────────────────────────────────────────────┤
│  Clear Street API          Polygon.io API                           │
│  ┌─────────────────┐       ┌─────────────────┐                      │
│  │ /holdings       │       │ /options/chain  │                      │
│  │ /pnl-summary    │       │ Greeks, IV, Bid/│                      │
│  │ (positions,qty) │       │ Ask prices      │                      │
│  └────────┬────────┘       └────────┬────────┘                      │
│           │                         │                                │
│           └────────────┬────────────┘                                │
│                        ▼                                             │
│              Position Enrichment Service                             │
│              (lib/services/position-enrichment.ts)                   │
│                        │                                             │
│                        ▼                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    DerivativesUnified                        │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │ Account      │  │ Positions    │  │ Strategy     │       │    │
│  │  │ Summary      │  │ Table        │  │ Builder      │       │    │
│  │  │ (P&L cards)  │  │ (real pos)   │  │ (simulation) │       │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `lib/api/clear-street.ts` | Clear Street API wrapper (OAuth, holdings, P&L) |
| `lib/services/position-enrichment.ts` | Enriches positions with Greeks from Polygon |
| `lib/utils/occ-parser.ts` | Parses OCC option symbols (e.g., `MSTR  260220P00130000`) |
| `actions/clear-street.ts` | Server actions for fetching data |
| `types/clear-street.ts` | TypeScript types for Clear Street data |
| `app/.../derivatives-positions/` | Page and components |

## Clear Street API Integration

### Authentication
- OAuth2 via Auth0: `https://auth.clearstreet.io/oauth/token`
- Client credentials flow with audience `https://api.clearstreet.io`
- Token cached with 5-minute buffer before expiry

### Endpoints Used

| Endpoint | Status | Data Returned |
|----------|--------|---------------|
| `GET /studio/v2/accounts` | ✅ Working | Account info |
| `GET /studio/v2/accounts/{id}/holdings` | ✅ Working | Positions (symbol, quantity) - **NO cost basis** |
| `GET /studio/v2/accounts/{id}/pnl-summary` | ✅ Working | Account-level P&L (day, unrealized, realized) |
| `GET /studio/v2/accounts/{id}/positions` | ❌ 403 | Would have cost basis |
| `GET /studio/v2/accounts/{id}/trades` | ❌ 403 | Trade history |

### Environment Variables

```bash
CLEAR_STREET_CLIENT_ID=       # OAuth client ID
CLEAR_STREET_CLIENT_SECRET=   # OAuth client secret
CLEAR_STREET_ACCOUNT_ID=      # Account ID (e.g., 116206)
CLEAR_STREET_ENTITY_ID=       # Entity ID (e.g., 8276)
CLEAR_STREET_ENVIRONMENT=     # "production" or "sandbox"
```

## Pending: Waiting for Clear Street

**Requested from Clear Street team (2026-02-02):**

1. **`/positions` endpoint access** - Need position-level cost basis
   - Currently showing $0.00 avg cost for all positions
   - Cannot calculate true P&L per position without this

2. **`/trades` endpoint access** - Trade history
   - Would enable reconstructing cost basis from trades
   - Useful for performance tracking and tax reporting

**Current workaround:** Account-level P&L (Day P&L, Unrealized P&L) is accurate because Clear Street calculates it server-side. Per-position P&L shows as "Mkt Value" since we don't have cost basis.

## Greeks Enrichment (Polygon.io)

Since Clear Street doesn't provide Greeks, we enrich positions using Polygon.io:

1. Parse OCC symbol to extract underlying, strike, expiration, type
2. Fetch options chain from Polygon for that underlying/expiration
3. Match position to chain contract by strike/type
4. Extract: delta, gamma, theta, vega, IV, bid, ask, mid price

**Note:** Greeks are enriched on each page load and refresh (5-min auto-refresh).

## Strategy Builder

The unified strategy builder allows:
- Adding real positions from Clear Street to analyze
- Adding simulated legs from the options chain
- Viewing combined Greeks exposure
- P&L analysis with breakeven calculations

**Warning:** Mixing underlyings (e.g., MSTR + RIOT) shows a warning since breakeven analysis is meaningless across different underlyings.

## Data Flow

```
1. Page loads → Server action fetches Clear Street data
2. Holdings + P&L summary returned
3. Position enrichment service groups by underlying/expiration
4. Polygon.io options chains fetched for each group
5. Positions matched to contracts, Greeks extracted
6. Enriched positions displayed in table
7. Auto-refresh every 5 minutes
```

## Components

### AccountSummary
Displays P&L cards from Clear Street:
- Day P&L
- Unrealized P&L
- Long/Short Market Value
- Net Delta (shares equivalent)
- Theta (daily decay)

### PositionsTable
Shows all option positions with:
- Position details (underlying, strike, expiration, type)
- Quantity
- Avg Cost (currently $0.00 - pending API access)
- Current price (from Polygon)
- Market Value
- Delta exposure
- IV
- Days to expiration
- **Totals row** with aggregate values

### UnifiedBuilder
Strategy builder for analyzing positions:
- Real positions section (from Clear Street)
- Simulated adjustments section (from options chain)
- Greeks summary (delta, gamma, theta, vega)
- Adjustment impact calculator

### Options Chain Table
Inline table for adding simulated legs:
- Call/Put columns with B(uy)/S(ell) buttons
- Strike highlighting for ATM
- Selected strikes highlighted
