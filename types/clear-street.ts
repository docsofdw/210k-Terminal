/**
 * Clear Street API Types
 *
 * Type definitions for Clear Street Studio SDK integration.
 * Used for fetching real derivative positions and P&L data.
 */

// ============ Clear Street SDK Types ============

export interface ClearStreetPosition {
  account_id: string
  account_number: string
  average_cost: number
  quantity: string // Signed quantity (negative = short)
  symbol: string // OCC symbol for options, ticker for equities
}

export interface ClearStreetPnlSummary {
  account_id: string
  account_number: string
  day_pnl: number
  overnight_pnl: number
  realized_pnl: number
  unrealized_pnl: number
  total_pnl: number
  net_pnl: number
  equity: number
  long_market_value: number
  short_market_value: number
  gross_market_value: number
  net_market_value: number
  total_fees: number
  timestamp: number
  sod_equity?: number
  sod_long_market_value?: number
  sod_short_market_value?: number
  sod_gross_market_value?: number
}

export interface ClearStreetTrade {
  trade_id: string
  order_id: string
  symbol: string
  side: "buy" | "sell" | "sell-short"
  quantity: string
  price: string
  running_position: string
  created_at: number
  account_id?: string
  account_number?: string
}

export interface ClearStreetAccount {
  account_id: string
  account_number: string
  name?: string
  entity_id?: string
}

// ============ Parsed Option Types ============

export interface ParsedOption {
  underlying: string
  expiration: string // ISO date format (YYYY-MM-DD)
  type: "call" | "put"
  strike: number
  isOption: true
}

export interface ParsedEquity {
  symbol: string
  isOption: false
}

export type ParsedSymbol = ParsedOption | ParsedEquity

// ============ Enriched Position Types ============

export interface EnrichedPosition {
  // From Clear Street
  accountId: string
  accountNumber: string
  clearStreetSymbol: string // Original symbol from CS
  quantity: number // Signed (negative = short)
  averageCost: number

  // Parsed from OCC symbol (null if equity)
  underlying: string
  expiration: string | null
  strike: number | null
  optionType: "call" | "put" | null

  // From Polygon.io (null if unavailable)
  currentPrice: number | null // Mid price
  bid: number | null
  ask: number | null
  iv: number | null
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null

  // Calculated values
  marketValue: number // quantity * currentPrice * multiplier
  costBasis: number // quantity * averageCost * multiplier
  unrealizedPnl: number // marketValue - costBasis
  unrealizedPnlPercent: number
  deltaExposure: number // quantity * delta * multiplier
  gammaExposure: number
  thetaExposure: number
  vegaExposure: number

  // Metadata
  isOption: boolean
  multiplier: number // 100 for options, 1 for equities
  source: "clear-street"
  enrichedAt: Date | null
  error?: string // If enrichment failed
}

// ============ API Response Types ============

export interface ClearStreetPositionsResponse {
  positions: EnrichedPosition[]
  summary: {
    totalPositions: number
    optionsCount: number
    equitiesCount: number
    totalMarketValue: number
    totalUnrealizedPnl: number
    totalDelta: number
    totalGamma: number
    totalTheta: number
    totalVega: number
  }
  updatedAt: Date
}

export interface ClearStreetPnlResponse {
  pnl: ClearStreetPnlSummary
  updatedAt: Date
}

// ============ Configuration ============

export interface ClearStreetConfig {
  clientId: string
  clientSecret: string
  accountId: string
  entityId: string
  environment: "sandbox" | "production"
}

// ============ Error Types ============

export class ClearStreetApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message)
    this.name = "ClearStreetApiError"
  }
}
