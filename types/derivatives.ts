/**
 * Derivatives Strategy Simulator Types
 *
 * Core type definitions for options trading, strategies,
 * and analysis calculations.
 */

// ============ Enums & Literals ============

export type OptionType = "call" | "put"

export type Action = "buy" | "sell"

export type Underlying =
  | "IBIT"
  | "FBTC"
  | "GBTC"
  | "BITO"
  | "MSTR"
  | "COIN"
  | "MARA"
  | "RIOT"
  | "CLSK"
  | "BITF"
  | "HUT"
  | "IREN"

export const SUPPORTED_UNDERLYINGS: {
  symbol: Underlying
  type: "ETF" | "Stock"
  name: string
}[] = [
  { symbol: "IBIT", type: "ETF", name: "BlackRock Bitcoin ETF" },
  { symbol: "FBTC", type: "ETF", name: "Fidelity Bitcoin ETF" },
  { symbol: "GBTC", type: "ETF", name: "Grayscale Bitcoin Trust" },
  { symbol: "BITO", type: "ETF", name: "ProShares Bitcoin Strategy" },
  { symbol: "MSTR", type: "Stock", name: "MicroStrategy" },
  { symbol: "COIN", type: "Stock", name: "Coinbase" },
  { symbol: "MARA", type: "Stock", name: "Marathon Digital" },
  { symbol: "RIOT", type: "Stock", name: "Riot Platforms" },
  { symbol: "CLSK", type: "Stock", name: "CleanSpark" },
  { symbol: "BITF", type: "Stock", name: "Bitfarms" },
  { symbol: "HUT", type: "Stock", name: "Hut 8" },
  { symbol: "IREN", type: "Stock", name: "Iris Energy" }
]

// ============ Option Contract ============

export interface OptionContract {
  symbol: string // Option symbol (e.g., "IBIT240315C00055000")
  underlying: string
  expiration: string // ISO date string (e.g., "2026-03-15")
  strike: number
  type: OptionType

  // Pricing
  bid: number | null
  ask: number | null
  last: number | null
  mid: number | null

  // Volume & Interest
  volume: number
  openInterest: number

  // Greeks
  iv: number | null // Implied volatility
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null

  // Metadata
  updated: Date | null
}

// ============ Options Chain ============

export interface OptionsChain {
  symbol: string
  underlyingPrice: number
  expiration: string
  expirationDate: Date
  daysToExpiry: number
  calls: OptionContract[]
  puts: OptionContract[]
  updated: Date
}

export interface OptionsExpirations {
  symbol: string
  expirations: string[] // ISO date strings sorted ascending
  updated: Date
}

// ============ Strategy Components ============

export interface OptionLeg {
  id: string // Unique ID for React keys
  contract: OptionContract
  action: Action
  quantity: number
  // Computed values
  cost: number // Total cost/credit for this leg (positive = debit, negative = credit)
  btcEquivalent: number | null // BTC equivalent strike price
}

export interface Strategy {
  id?: string // DB ID for saved strategies
  name: string
  underlying: string
  underlyingPrice: number
  btcPrice: number
  legs: OptionLeg[]
  notes?: string
  createdAt?: Date
  updatedAt?: Date
}

// ============ Strategy Analysis ============

export interface BreakevenPoint {
  price: number // Underlying price at breakeven
  btcPrice: number | null // Equivalent BTC price
}

export interface PnLPoint {
  price: number // Underlying price
  btcPrice: number | null // Equivalent BTC price
  pnl: number // P&L in USD
  pnlPercent: number // P&L as % of total cost
  pnlBtc: number | null // P&L in BTC
}

export interface StrategyAnalysis {
  // Cost Summary
  totalCost: number // Net debit (+) or credit (-) to open
  totalCostBtc: number | null

  // Risk Metrics
  maxProfit: number | "unlimited"
  maxProfitPrice: number | null // Price at max profit
  maxLoss: number | "unlimited"
  maxLossPrice: number | null // Price at max loss

  // Breakevens
  breakevens: BreakevenPoint[]

  // Current P&L
  currentPnl: number
  currentPnlPercent: number
  currentPnlBtc: number | null

  // P&L at specific prices
  targetPnls: PnLPoint[]

  // Time analysis
  daysToExpiry: number
  theta: number // Total theta across all legs

  // Greeks summary
  totalDelta: number
  totalGamma: number
  totalVega: number
}

// ============ Saved Strategy (DB Model) ============

export interface SavedStrategyLeg {
  optionSymbol: string
  underlying: string
  expiration: string
  strike: number
  type: OptionType
  action: Action
  quantity: number
}

export interface SavedStrategy {
  id: string
  userId: string
  name: string
  underlying: string
  legs: SavedStrategyLeg[]
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

// ============ API Response Types ============

export interface OptionsExpirationsResponse {
  symbol: string
  expirations: string[]
}

export interface OptionsChainResponse {
  symbol: string
  expiration: string
  underlyingPrice: number
  daysToExpiry: number
  calls: OptionContract[]
  puts: OptionContract[]
}

export interface StrategyAnalysisRequest {
  legs: {
    strike: number
    type: OptionType
    action: Action
    quantity: number
    premium: number // Per contract premium
    iv: number | null
    delta: number | null
    gamma: number | null
    theta: number | null
    vega: number | null
  }[]
  underlyingPrice: number
  btcPrice: number
  riskFreeRate: number // Default 0.05 (5%)
  daysToExpiry: number
  targetPrices: number[] // Prices to calculate P&L at
}

export interface StrategyAnalysisResponse extends StrategyAnalysis {}
