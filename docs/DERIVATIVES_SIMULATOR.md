# Derivatives Strategy Simulator

Multi-leg options strategy simulator for Bitcoin proxy stocks (IBIT, MSTR, MARA, etc.) with BTC equivalent calculations and full Greeks support.

## Overview

The derivatives simulator allows users to:
- Build multi-leg options strategies (straddles, strangles, spreads, etc.)
- View real-time options chains with Greeks (delta, gamma, theta, vega)
- Calculate P&L at expiration with visual charts
- See BTC-equivalent strike prices
- Save and load strategies
- Use pre-built strategy templates

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React/Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │SymbolSelector│  │OptionsChain  │  │   StrategyBuilder    │   │
│  └──────────────┘  │    Table     │  │   + Templates        │   │
│                    └──────────────┘  └──────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  PnL Chart   │  │AnalysisPanel │  │  SavedStrategies     │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Next.js API Routes
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API Layer                                  │
│  /api/options/expirations/[symbol]  - Get expiration dates      │
│  /api/options/chain/[symbol]        - Get options chain         │
│  /api/options/analyze               - Analyze strategy          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
                         Polygon.io API
                    (Options data + Greeks)
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 15 | Full-stack React |
| Language | TypeScript | Type safety |
| Styling | Tailwind + Shadcn | UI components |
| Charts | Recharts | P&L visualization |
| Options API | Polygon.io (Massive) | Options chains with Greeks |
| Database | Supabase (PostgreSQL) | Saved strategies |

## File Structure

```
app/
├── api/options/
│   ├── expirations/[symbol]/route.ts   # GET expirations
│   ├── chain/[symbol]/route.ts         # GET options chain
│   └── analyze/route.ts                # POST strategy analysis
└── (authenticated)/dashboard/derivatives/
    ├── page.tsx                        # Main page
    └── _components/
        ├── derivatives-simulator.tsx   # Main orchestrator
        ├── symbol-selector.tsx         # Symbol + expiration picker
        ├── options-chain-table.tsx     # Calls/puts table
        ├── strategy-builder.tsx        # Leg management
        ├── strategy-leg-row.tsx        # Individual leg display
        ├── strategy-templates.tsx      # Pre-built strategies
        ├── pnl-chart.tsx              # P&L visualization
        ├── analysis-panel.tsx          # Greeks, breakevens, P&L
        └── saved-strategies.tsx        # Load/save strategies

lib/
├── api/
│   └── polygon-options.ts             # Polygon.io API wrapper
├── services/
│   ├── black-scholes.ts               # Options pricing model
│   └── strategy-analyzer.ts           # P&L calculations
└── utils/
    └── btc-conversion.ts              # BTC equivalent utilities

types/
└── derivatives.ts                     # TypeScript types

db/schema/
└── saved-strategies.ts                # Database schema

actions/
└── strategies.ts                      # Server actions for CRUD
```

## API Endpoints

### GET /api/options/expirations/[symbol]

Get available expiration dates for a symbol.

**Response:**
```json
{
  "symbol": "IBIT",
  "expirations": ["2026-02-07", "2026-02-14", "2026-02-21", ...]
}
```

### GET /api/options/chain/[symbol]?expiration=YYYY-MM-DD

Get options chain with Greeks for a symbol and expiration.

**Response:**
```json
{
  "symbol": "IBIT",
  "expiration": "2026-02-21",
  "underlyingPrice": 47.49,
  "daysToExpiry": 19,
  "calls": [
    {
      "symbol": "O:IBIT260221C00030000",
      "strike": 30,
      "type": "call",
      "bid": null,
      "ask": null,
      "last": 17.50,
      "mid": 17.50,
      "volume": 100,
      "openInterest": 500,
      "iv": 0.65,
      "delta": 0.95,
      "gamma": 0.02,
      "theta": -0.05,
      "vega": 0.03
    }
  ],
  "puts": [...]
}
```

### POST /api/options/analyze

Analyze a multi-leg options strategy.

**Request:**
```json
{
  "legs": [
    {
      "strike": 50,
      "type": "call",
      "action": "buy",
      "quantity": 1,
      "premium": 3.50,
      "iv": 0.65,
      "delta": 0.55,
      "gamma": 0.04,
      "theta": -0.08,
      "vega": 0.12
    }
  ],
  "underlyingPrice": 47.49,
  "btcPrice": 78294,
  "riskFreeRate": 0.05,
  "daysToExpiry": 19,
  "targetPrices": [40, 45, 50, 55, 60]
}
```

**Response:**
```json
{
  "totalCost": 350,
  "totalCostBtc": 0.00447,
  "breakevens": [{ "price": 53.50, "btcPrice": 88250 }],
  "maxProfit": "unlimited",
  "maxLoss": 350,
  "currentPnl": -25,
  "currentPnlPercent": -7.14,
  "targetPnls": [
    { "price": 40, "pnl": -350, "pnlPercent": -100, "btcPrice": 66000 },
    { "price": 50, "pnl": -50, "pnlPercent": -14.3, "btcPrice": 82500 }
  ],
  "totalDelta": 0.55,
  "totalGamma": 0.04,
  "totalVega": 0.12,
  "theta": -8,
  "daysToExpiry": 19
}
```

## Supported Underlyings

| Symbol | Type | Description |
|--------|------|-------------|
| IBIT | ETF | BlackRock Bitcoin ETF |
| FBTC | ETF | Fidelity Bitcoin ETF |
| GBTC | ETF | Grayscale Bitcoin Trust |
| BITO | ETF | ProShares Bitcoin Strategy |
| MSTR | Stock | MicroStrategy |
| COIN | Stock | Coinbase |
| MARA | Stock | Marathon Digital |
| RIOT | Stock | Riot Platforms |
| CLSK | Stock | CleanSpark |
| BITF | Stock | Bitfarms |
| HUT | Stock | Hut 8 |
| IREN | Stock | Iris Energy |

## Strategy Templates

Pre-built strategies available via the "Strategies" dropdown:

### Bullish
- **Long Call** - Buy OTM call, unlimited upside
- **Bull Call Spread** - Buy lower strike, sell higher strike call
- **Cash Secured Put** - Sell OTM put, collect premium

### Bearish
- **Long Put** - Buy OTM put, profit from downside
- **Bear Put Spread** - Buy higher strike, sell lower strike put

### Neutral
- **Long Straddle** - Buy ATM call + put, profit from big move
- **Short Straddle** - Sell ATM call + put, profit from low volatility
- **Long Strangle** - Buy OTM call + put, cheaper than straddle
- **Short Strangle** - Sell OTM call + put, range-bound play
- **Iron Condor** - Sell strangle + buy wings, defined risk

### Hedge
- **Protective Put** - Buy put to protect long stock
- **Collar** - Buy put + sell call, cap upside for downside protection
- **Covered Call** - Sell call against long stock
- **Risk Reversal** - Sell put + buy call, synthetic long

## Core Algorithms

### Black-Scholes Formula

```typescript
// lib/services/black-scholes.ts

d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)
d2 = d1 - σ√T

Call Price = S·N(d1) - K·e^(-rT)·N(d2)
Put Price  = K·e^(-rT)·N(-d2) - S·N(-d1)

Where:
  S = Spot price
  K = Strike price
  r = Risk-free rate (default 5%)
  σ = Implied volatility
  T = Time to expiry (years)
  N() = Cumulative normal distribution
```

### P&L at Expiration

```typescript
// For calls: max(0, price - strike) - premium
// For puts: max(0, strike - price) - premium
// Adjusted for buy/sell action and quantity
```

### Breakeven Calculation

Uses bisection method to find where P&L crosses zero:
1. Sample P&L across price range (70% to 130% of current)
2. Find intervals where sign changes
3. Linear interpolation to get precise breakeven

### BTC Equivalent Conversion

```typescript
// lib/utils/btc-conversion.ts

// Strike to equivalent BTC price
ratio = underlyingPrice / btcPrice
btcEquivalent = strike / ratio

// Example: IBIT at $47.49, BTC at $78,294
// Strike $50 = BTC @ $82,500
```

## Database Schema

```sql
-- db/schema/saved-strategies.ts

CREATE TABLE saved_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES customers(user_id),
  name TEXT NOT NULL,
  underlying TEXT NOT NULL,
  legs JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Environment Variables

```bash
# Polygon.io (Massive) API - Options data with Greeks
POLYGON_API_KEY="your_polygon_api_key"
```

## Data Provider

**Polygon.io (now Massive)** - Options Starter plan ($29/mo)

Features:
- Full options chains with Greeks (delta, gamma, theta, vega)
- Implied volatility
- Real-time and delayed data
- No IP restrictions (serverless-friendly)
- RESTful API

Endpoints used:
- `GET /v3/reference/options/contracts` - Get available contracts/expirations
- `GET /v3/snapshot/options/{underlying}` - Get options chain with Greeks
- `GET /v2/aggs/ticker/{symbol}/prev` - Get underlying price

## Usage

1. Navigate to `/dashboard/derivatives`
2. Select an underlying (e.g., IBIT)
3. Choose an expiration date
4. Either:
   - Click buy/sell buttons in the options chain to add legs manually
   - Use the "Strategies" dropdown to apply a template
5. View P&L chart and analysis
6. Optionally save the strategy for later

## P&L Chart Features

- **Split-color display** - Green fill for profit zones, red for loss zones
- **Zero line** - Reference line at $0 P&L
- **Current price marker** - Orange dashed line at current underlying price
- **Breakeven markers** - Gray dashed lines at breakeven prices
- **Interactive tooltip** - Shows P&L and BTC equivalent at each price point

## Options Chain Table Features

- **Straddle view** - Shows calls on left, puts on right, strike in center
- **ITM highlighting** - Green background for ITM calls, red for ITM puts
- **ATM badge** - Orange "ATM" badge on at-the-money strikes
- **BTC equivalent** - Shows what BTC price each strike corresponds to
- **One-click trading** - Buy/sell buttons for quick leg addition
