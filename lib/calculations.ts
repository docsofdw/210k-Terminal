/**
 * Treasury Intelligence Calculations
 *
 * Core formulas:
 * - mNAV = EV_USD / BTC_NAV
 * - EV = Market_Cap + Debt + Preferreds - Cash
 * - BTC_NAV = BTC_Holdings * BTC_Price
 * - Sats_per_Share = (BTC * 100,000,000) / Shares_Outstanding
 */

const SATS_PER_BTC = 100_000_000

export interface CompanyMetrics {
  // Input data
  btcHoldings: number
  btcPrice: number
  stockPrice: number
  sharesOutstanding: number
  marketCapUsd: number
  cashUsd: number
  debtUsd: number
  preferredsUsd: number
  tradingCurrency: string
  fxRate: number // Rate to convert to USD (1 if already USD)
}

export interface CalculatedMetrics {
  // Core metrics
  btcNav: number // BTC_Holdings * BTC_Price
  enterpriseValue: number // Mkt_Cap + Debt + Preferreds - Cash
  mNav: number // EV / BTC_NAV
  satsPerShare: number // (BTC * 100M) / Shares

  // Additional metrics
  btcPerShare: number // BTC / Shares
  premiumDiscount: number // (mNAV - 1) * 100 (percentage)
  marketCapBtc: number // Market Cap in BTC terms
  btcDelta: number // Difference between mNAV and 1
}

/**
 * Calculate all treasury metrics for a company
 */
export function calculateMetrics(data: CompanyMetrics): CalculatedMetrics {
  const {
    btcHoldings,
    btcPrice,
    sharesOutstanding,
    marketCapUsd,
    cashUsd,
    debtUsd,
    preferredsUsd
  } = data

  // BTC NAV = BTC Holdings * BTC Price
  const btcNav = btcHoldings * btcPrice

  // Enterprise Value = Market Cap + Debt + Preferreds - Cash
  const enterpriseValue = marketCapUsd + debtUsd + preferredsUsd - cashUsd

  // mNAV = EV / BTC NAV (handle division by zero)
  const mNav = btcNav > 0 ? enterpriseValue / btcNav : 0

  // Sats per Share = (BTC * 100M) / Shares Outstanding
  const satsPerShare =
    sharesOutstanding > 0
      ? (btcHoldings * SATS_PER_BTC) / sharesOutstanding
      : 0

  // BTC per Share = BTC / Shares
  const btcPerShare =
    sharesOutstanding > 0 ? btcHoldings / sharesOutstanding : 0

  // Premium/Discount = (mNAV - 1) * 100
  const premiumDiscount = (mNav - 1) * 100

  // Market Cap in BTC terms
  const marketCapBtc = btcPrice > 0 ? marketCapUsd / btcPrice : 0

  // BTC Delta = How much the mNAV deviates from 1
  const btcDelta = mNav - 1

  return {
    btcNav,
    enterpriseValue,
    mNav,
    satsPerShare,
    btcPerShare,
    premiumDiscount,
    marketCapBtc,
    btcDelta
  }
}

/**
 * Format number with appropriate decimal places
 */
export function formatNumber(
  value: number,
  options: {
    decimals?: number
    style?: "decimal" | "currency" | "percent"
    currency?: string
    compact?: boolean
  } = {}
): string {
  const { decimals = 2, style = "decimal", currency = "USD", compact } = options

  if (compact) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: decimals
    }).format(value)
  }

  if (style === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value)
  }

  if (style === "percent") {
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value / 100)
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

/**
 * Format BTC amount
 */
export function formatBtc(value: number, decimals = 2): string {
  return `₿${formatNumber(value, { decimals })}`
}

/**
 * Format sats amount
 */
export function formatSats(value: number): string {
  return `${formatNumber(Math.round(value), { decimals: 0 })} sats`
}

/**
 * Format mNAV multiplier
 */
export function formatMNav(value: number): string {
  return `${formatNumber(value, { decimals: 2 })}x`
}

/**
 * Format premium/discount percentage
 */
export function formatPremiumDiscount(value: number): string {
  const prefix = value >= 0 ? "+" : ""
  return `${prefix}${formatNumber(value, { decimals: 1 })}%`
}

/**
 * Get color class for premium/discount
 */
export function getPremiumDiscountColor(value: number): string {
  if (value > 50) return "text-red-500"
  if (value > 0) return "text-yellow-500"
  if (value < -20) return "text-green-500"
  if (value < 0) return "text-emerald-400"
  return "text-muted-foreground"
}

/**
 * Get color class for mNAV
 */
export function getMNavColor(value: number): string {
  if (value > 2) return "text-red-500"
  if (value > 1.5) return "text-orange-500"
  if (value > 1) return "text-yellow-500"
  if (value < 0.8) return "text-green-500"
  if (value < 1) return "text-emerald-400"
  return "text-muted-foreground"
}
