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
│  │ /pnl-details    │       │ /options/chain  │                      │
│  │ (positions,     │       │ Greeks, IV, Bid/│                      │
│  │  pricing, P&L)  │       │ Ask prices      │                      │
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
| `GET /studio/v2/accounts/{id}/pnl-details` | ✅ Working | **Primary endpoint** - Position-level pricing and P&L |
| `GET /studio/v2/accounts/{id}/pnl-summary` | ✅ Working | Account-level P&L (day, unrealized, realized) |
| `GET /studio/v2/accounts/{id}/holdings` | ✅ Working | Basic positions (symbol, quantity only) |
| `POST /studio/v2/entities/{id}/activity` | ❌ 403 | Trade history with cost basis (requires separate access) |
| `GET /studio/v2/accounts/{id}/trades` | ❌ 403 | Trade history |

### `/pnl-details` Data (Primary Endpoint)

The `/pnl-details` endpoint provides comprehensive position-level data:

| Field | Description |
|-------|-------------|
| `price` | Current mark-to-market price |
| `sod_price` | Start-of-day price (previous close) |
| `day_pnl` | Today's P&L |
| `unrealized_pnl` | Unrealized P&L |
| `realized_pnl` | Realized P&L from closed positions |
| `total_pnl` | Combined P&L |
| `overnight_pnl` | Overnight P&L |
| `net_market_value` | Current market value |
| `sod_market_value` | Start-of-day market value |
| `quantity` | Current position size |
| `bought_quantity` / `sold_quantity` | Intraday trade activity |
| `total_fees` | Accumulated fees |

**Note:** Clear Street uses mark-to-market methodology - cost basis resets to prior night's close daily.

### Environment Variables

```bash
CLEAR_STREET_CLIENT_ID=       # OAuth client ID
CLEAR_STREET_CLIENT_SECRET=   # OAuth client secret
CLEAR_STREET_ACCOUNT_ID=      # Account ID (e.g., 116206)
CLEAR_STREET_ENTITY_ID=       # Entity ID (e.g., 8276)
CLEAR_STREET_ENVIRONMENT=     # "production" or "sandbox"
```

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
1. Page loads → Server action calls getClearStreetPositions()
2. fetchPnlDetails() returns positions with pricing and P&L from Clear Street
3. Position enrichment service groups options by underlying/expiration
4. Polygon.io options chains fetched for each group (for Greeks)
5. Positions matched to contracts, Greeks extracted
6. Enriched positions displayed in table with:
   - Pricing/P&L from Clear Street
   - Greeks (delta, gamma, theta, vega, IV) from Polygon
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
- Quantity (green for long, red for short)
- SOD price (start-of-day mark-to-market price)
- Current price
- Day P&L (with color coding)
- Delta exposure (formatted as K notation, e.g., -12.8K)
- IV (implied volatility %)
- Days to expiration (with color-coded badges)
- **Totals row** with aggregate Day P&L and Delta

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
