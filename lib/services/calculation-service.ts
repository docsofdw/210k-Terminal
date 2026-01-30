/**
 * Calculation Service
 *
 * Computes all treasury metrics from raw market data:
 * - BTC NAV (BTC Holdings × BTC Price)
 * - Enterprise Value (Market Cap + Debt + Preferreds - Cash)
 * - mNAV (EV / BTC NAV)
 * - Sats per Share, etc.
 *
 * Replaces pre-calculated values from Google Sheets with local calculations.
 */

import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import { btcPrices } from "@/db/schema/btc-prices"
import { eq, desc } from "drizzle-orm"

const SATS_PER_BTC = 100_000_000

// ============ Types ============

export interface CalculationInput {
  // BTC data
  btcHoldings: number
  btcPrice: number

  // Stock data
  stockPrice: number
  sharesOutstanding: number
  dilutedShares: number

  // Market data
  marketCapUsd: number | null // If null, calculated from price × shares

  // Balance sheet data
  cashUsd: number
  debtUsd: number
  preferredsUsd: number

  // Optional: Currency conversion for non-USD stocks
  fxRate?: number // Local currency to USD (e.g., 150 for JPY)
  currency?: string
}

export interface CalculatedMetrics {
  // Core valuation
  btcNav: number
  marketCapUsd: number
  dilutedMarketCapUsd: number
  enterpriseValue: number
  dilutedEv: number

  // mNAV metrics
  basicMNav: number
  dilutedMNav: number
  priceAt1xDilutedMNav: number
  premiumDiscount: number // (dilutedMNav - 1) × 100

  // Per share metrics
  btcPerShare: number
  satsPerShare: number
  satsPerDollar: number

  // Ratios
  debtToBtcNav: number
  cashToBtcNav: number
}

// ============ Core Calculation ============

/**
 * Calculate all treasury metrics from raw data
 */
export function calculateMetrics(input: CalculationInput): CalculatedMetrics {
  const {
    btcHoldings,
    btcPrice,
    stockPrice,
    sharesOutstanding,
    dilutedShares,
    marketCapUsd: providedMarketCap,
    cashUsd,
    debtUsd,
    preferredsUsd,
    fxRate = 1,
    currency = "USD"
  } = input

  // Convert stock price to USD if needed
  const stockPriceUsd = currency === "USD" ? stockPrice : stockPrice / fxRate

  // Calculate market cap if not provided
  const marketCapUsd = providedMarketCap ?? (stockPriceUsd * sharesOutstanding)

  // Diluted market cap
  const dilutedMarketCapUsd = stockPriceUsd * dilutedShares

  // BTC NAV = BTC Holdings × BTC Price
  const btcNav = btcHoldings * btcPrice

  // Enterprise Value = Market Cap + Debt + Preferreds - Cash
  const enterpriseValue = marketCapUsd + debtUsd + preferredsUsd - cashUsd

  // Diluted EV = Diluted Market Cap + Debt + Preferreds - Cash
  const dilutedEv = dilutedMarketCapUsd + debtUsd + preferredsUsd - cashUsd

  // Basic mNAV = EV / BTC NAV (handle division by zero)
  const basicMNav = btcNav > 0 ? enterpriseValue / btcNav : 0

  // Diluted mNAV = Diluted EV / BTC NAV
  const dilutedMNav = btcNav > 0 ? dilutedEv / btcNav : 0

  // 1x Diluted mNAV Price = Current Price / Diluted mNAV
  // This is the "fair value" price if stock traded at 1x mNAV
  const priceAt1xDilutedMNav = dilutedMNav > 0 ? stockPriceUsd / dilutedMNav : 0

  // Premium/Discount = (dilutedMNav - 1) × 100
  const premiumDiscount = (dilutedMNav - 1) * 100

  // BTC per Share = BTC Holdings / Shares Outstanding
  const btcPerShare = sharesOutstanding > 0 ? btcHoldings / sharesOutstanding : 0

  // Sats per Share = (BTC Holdings × 100M) / Shares Outstanding
  const satsPerShare = sharesOutstanding > 0
    ? (btcHoldings * SATS_PER_BTC) / sharesOutstanding
    : 0

  // Sats per Dollar = Sats per Share / Stock Price USD
  const satsPerDollar = stockPriceUsd > 0 ? satsPerShare / stockPriceUsd : 0

  // Debt to BTC NAV ratio
  const debtToBtcNav = btcNav > 0 ? debtUsd / btcNav : 0

  // Cash to BTC NAV ratio
  const cashToBtcNav = btcNav > 0 ? cashUsd / btcNav : 0

  return {
    btcNav,
    marketCapUsd,
    dilutedMarketCapUsd,
    enterpriseValue,
    dilutedEv,
    basicMNav,
    dilutedMNav,
    priceAt1xDilutedMNav,
    premiumDiscount,
    btcPerShare,
    satsPerShare,
    satsPerDollar,
    debtToBtcNav,
    cashToBtcNav
  }
}

// ============ Database Operations ============

/**
 * Get the latest BTC price from database
 */
export async function getLatestBtcPrice(): Promise<number> {
  const [latest] = await db
    .select({ priceUsd: btcPrices.priceUsd })
    .from(btcPrices)
    .orderBy(desc(btcPrices.priceAt))
    .limit(1)

  return latest ? parseFloat(latest.priceUsd) : 0
}

/**
 * Recalculate all metrics for a single company and update the database
 */
export async function recalculateCompanyMetrics(companyId: string): Promise<void> {
  // Get company data
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))

  if (!company) {
    console.warn(`Company ${companyId} not found`)
    return
  }

  // Get current BTC price
  const btcPrice = await getLatestBtcPrice()
  if (btcPrice === 0) {
    console.warn("No BTC price available, skipping calculation")
    return
  }

  // Parse company data
  const btcHoldings = parseFloat(company.btcHoldings || "0")
  const stockPrice = parseFloat(company.price || "0")
  const sharesOutstanding = parseFloat(company.sharesOutstanding || "0")
  const dilutedShares = parseFloat(company.dilutedShares || company.sharesOutstanding || "0")
  const marketCapUsd = company.marketCapUsd ? parseFloat(company.marketCapUsd) : null
  const cashUsd = parseFloat(company.cashUsd || "0")
  const debtUsd = parseFloat(company.debtUsd || "0")
  const preferredsUsd = parseFloat(company.preferredsUsd || "0")

  // Get FX rate for non-USD stocks
  const fxRate = parseFloat(company.conversionRate || "1")
  const currency = company.currencyCode || "USD"

  // Calculate metrics
  const metrics = calculateMetrics({
    btcHoldings,
    btcPrice,
    stockPrice,
    sharesOutstanding,
    dilutedShares,
    marketCapUsd,
    cashUsd,
    debtUsd,
    preferredsUsd,
    fxRate,
    currency
  })

  // Update database
  await db.update(companies)
    .set({
      btcNavUsd: metrics.btcNav.toString(),
      marketCapUsd: metrics.marketCapUsd.toString(),
      dilutedMarketCapUsd: metrics.dilutedMarketCapUsd.toString(),
      enterpriseValueUsd: metrics.enterpriseValue.toString(),
      dilutedEvUsd: metrics.dilutedEv.toString(),
      basicMNav: metrics.basicMNav.toString(),
      dilutedMNav: metrics.dilutedMNav.toString(),
      priceAt1xDilutedMNav: metrics.priceAt1xDilutedMNav.toString(),
      updatedAt: new Date()
    })
    .where(eq(companies.id, companyId))
}

/**
 * Recalculate metrics for all companies
 * Used after BTC price updates or batch data refreshes
 */
export async function recalculateAllCompanyMetrics(): Promise<{ updated: number; errors: number }> {
  // Get BTC price once
  const btcPrice = await getLatestBtcPrice()
  if (btcPrice === 0) {
    console.warn("No BTC price available, skipping batch calculation")
    return { updated: 0, errors: 0 }
  }

  // Get all tracked companies
  const allCompanies = await db
    .select()
    .from(companies)
    .where(eq(companies.isTracked, true))

  let updated = 0
  let errors = 0

  for (const company of allCompanies) {
    try {
      // Parse company data
      const btcHoldings = parseFloat(company.btcHoldings || "0")

      // Skip companies with no BTC holdings
      if (btcHoldings === 0) continue

      const stockPrice = parseFloat(company.price || "0")
      const sharesOutstanding = parseFloat(company.sharesOutstanding || "0")
      const dilutedShares = parseFloat(company.dilutedShares || company.sharesOutstanding || "0")
      const marketCapUsd = company.marketCapUsd ? parseFloat(company.marketCapUsd) : null
      const cashUsd = parseFloat(company.cashUsd || "0")
      const debtUsd = parseFloat(company.debtUsd || "0")
      const preferredsUsd = parseFloat(company.preferredsUsd || "0")
      const fxRate = parseFloat(company.conversionRate || "1")
      const currency = company.currencyCode || "USD"

      // Calculate metrics
      const metrics = calculateMetrics({
        btcHoldings,
        btcPrice,
        stockPrice,
        sharesOutstanding,
        dilutedShares,
        marketCapUsd,
        cashUsd,
        debtUsd,
        preferredsUsd,
        fxRate,
        currency
      })

      // Update database
      await db.update(companies)
        .set({
          btcNavUsd: metrics.btcNav.toString(),
          marketCapUsd: metrics.marketCapUsd.toString(),
          dilutedMarketCapUsd: metrics.dilutedMarketCapUsd.toString(),
          enterpriseValueUsd: metrics.enterpriseValue.toString(),
          dilutedEvUsd: metrics.dilutedEv.toString(),
          basicMNav: metrics.basicMNav.toString(),
          dilutedMNav: metrics.dilutedMNav.toString(),
          priceAt1xDilutedMNav: metrics.priceAt1xDilutedMNav.toString(),
          updatedAt: new Date()
        })
        .where(eq(companies.id, company.id))

      updated++
    } catch (error) {
      console.error(`Error calculating metrics for ${company.ticker}:`, error)
      errors++
    }
  }

  return { updated, errors }
}

// ============ Price Change Calculations ============

/**
 * Calculate price change percentage
 */
export function calculatePriceChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

/**
 * Calculate 52-week high delta (% below 52-week high)
 */
export function calculateHighDelta(current: number, high52Week: number): number {
  if (high52Week === 0) return 0
  return ((current - high52Week) / high52Week) * 100
}

/**
 * Calculate 200-day average delta (% above/below 200D avg)
 */
export function calculateAvgDelta(current: number, avg200d: number): number {
  if (avg200d === 0) return 0
  return ((current - avg200d) / avg200d) * 100
}

// ============ Utilities ============

/**
 * Format mNAV for display
 */
export function formatMNav(mNav: number): string {
  return `${mNav.toFixed(2)}x`
}

/**
 * Get mNAV color class based on value
 */
export function getMNavColorClass(mNav: number): string {
  if (mNav > 2.0) return "text-red-500"
  if (mNav > 1.5) return "text-orange-500"
  if (mNav > 1.0) return "text-yellow-500"
  if (mNav < 0.8) return "text-green-500"
  if (mNav < 1.0) return "text-emerald-400"
  return "text-muted-foreground"
}

/**
 * Get premium/discount label
 */
export function getPremiumDiscountLabel(mNav: number): string {
  const percent = (mNav - 1) * 100
  if (percent > 0) {
    return `+${percent.toFixed(1)}% premium`
  } else if (percent < 0) {
    return `${percent.toFixed(1)}% discount`
  }
  return "At NAV"
}
