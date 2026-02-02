/**
 * Options Strategy Analyzer
 *
 * Calculates P&L, breakevens, and risk metrics for multi-leg options strategies.
 */

import type {
  OptionLeg,
  BreakevenPoint,
  PnLPoint,
  StrategyAnalysis,
  OptionType,
  Action
} from "@/types/derivatives"
import {
  priceOption,
  daysToYears,
  getRiskFreeRate
} from "./black-scholes"
import { usdToBtc, strikeToEquivalentBtcPrice } from "@/lib/utils/btc-conversion"

// ============ Single Leg P&L ============

interface SimpleLeg {
  strike: number
  type: OptionType
  action: Action
  quantity: number
  premium: number // Premium paid/received per contract
  iv: number | null
}

/**
 * Calculate P&L for a single leg at expiration (no time value)
 *
 * @param leg - Option leg details
 * @param priceAtExpiry - Underlying price at expiration
 */
export function calculateLegPnlAtExpiry(
  leg: SimpleLeg,
  priceAtExpiry: number
): number {
  // Calculate intrinsic value at expiration
  let intrinsicValue: number
  if (leg.type === "call") {
    intrinsicValue = Math.max(0, priceAtExpiry - leg.strike)
  } else {
    intrinsicValue = Math.max(0, leg.strike - priceAtExpiry)
  }

  // P&L per contract
  const pnlPerContract =
    leg.action === "buy"
      ? intrinsicValue - leg.premium
      : leg.premium - intrinsicValue

  // Total P&L (each contract = 100 shares)
  return pnlPerContract * leg.quantity * 100
}

/**
 * Calculate P&L for a single leg with time value (using Black-Scholes)
 *
 * @param leg - Option leg details
 * @param currentPrice - Current underlying price
 * @param daysToExpiry - Days remaining to expiration
 * @param riskFreeRate - Risk-free rate (default: 5%)
 */
export function calculateLegPnlWithTimeValue(
  leg: SimpleLeg,
  currentPrice: number,
  daysToExpiry: number,
  riskFreeRate: number = getRiskFreeRate()
): number {
  const timeToExpiry = daysToYears(daysToExpiry)

  // If IV is not available, use at-expiry calculation
  if (leg.iv === null || leg.iv <= 0) {
    return calculateLegPnlAtExpiry(leg, currentPrice)
  }

  // Calculate theoretical price using Black-Scholes
  const theoreticalPrice = priceOption(
    currentPrice,
    leg.strike,
    timeToExpiry,
    riskFreeRate,
    leg.iv,
    leg.type
  )

  if (theoreticalPrice === null) {
    return calculateLegPnlAtExpiry(leg, currentPrice)
  }

  // P&L per contract
  const pnlPerContract =
    leg.action === "buy"
      ? theoreticalPrice - leg.premium
      : leg.premium - theoreticalPrice

  // Total P&L (each contract = 100 shares)
  return pnlPerContract * leg.quantity * 100
}

// ============ Strategy P&L ============

/**
 * Calculate total P&L for a strategy at a given price (at expiration)
 *
 * @param legs - Array of option legs
 * @param priceAtExpiry - Underlying price at expiration
 */
export function calculateStrategyPnlAtExpiry(
  legs: SimpleLeg[],
  priceAtExpiry: number
): number {
  return legs.reduce((total, leg) => {
    return total + calculateLegPnlAtExpiry(leg, priceAtExpiry)
  }, 0)
}

/**
 * Calculate total P&L for a strategy with time value
 *
 * @param legs - Array of option legs
 * @param currentPrice - Current underlying price
 * @param daysToExpiry - Days remaining to expiration
 */
export function calculateStrategyPnlWithTimeValue(
  legs: SimpleLeg[],
  currentPrice: number,
  daysToExpiry: number
): number {
  return legs.reduce((total, leg) => {
    return total + calculateLegPnlWithTimeValue(leg, currentPrice, daysToExpiry)
  }, 0)
}

// ============ Breakeven Calculation ============

/**
 * Find breakeven points using bisection method
 *
 * @param legs - Array of option legs
 * @param currentPrice - Current underlying price (used as reference)
 * @param searchRange - Range to search (default: 0.01 to 10x current price)
 */
export function findBreakevens(
  legs: SimpleLeg[],
  currentPrice: number,
  btcPrice: number | null = null
): BreakevenPoint[] {
  const breakevens: BreakevenPoint[] = []

  // Get all strikes to narrow down search
  const strikes = legs.map((l) => l.strike).sort((a, b) => a - b)
  const minStrike = Math.min(...strikes)
  const maxStrike = Math.max(...strikes)

  // Search range: 50% below lowest strike to 200% above highest strike
  const searchMin = Math.max(0.01, minStrike * 0.5)
  const searchMax = maxStrike * 2

  // Use small step to find sign changes (breakeven candidates)
  const step = (searchMax - searchMin) / 1000
  let prevPnl = calculateStrategyPnlAtExpiry(legs, searchMin)

  for (let price = searchMin + step; price <= searchMax; price += step) {
    const pnl = calculateStrategyPnlAtExpiry(legs, price)

    // Check for sign change (crossed zero)
    if ((prevPnl < 0 && pnl > 0) || (prevPnl > 0 && pnl < 0)) {
      // Refine using bisection
      const breakeven = bisectionFindRoot(
        legs,
        price - step,
        price,
        0.01 // Precision to 1 cent
      )

      if (breakeven !== null) {
        breakevens.push({
          price: Math.round(breakeven * 100) / 100,
          btcPrice:
            btcPrice !== null
              ? strikeToEquivalentBtcPrice(breakeven, currentPrice, btcPrice)
              : null
        })
      }
    }

    prevPnl = pnl
  }

  return breakevens
}

/**
 * Bisection method to find exact breakeven
 */
function bisectionFindRoot(
  legs: SimpleLeg[],
  low: number,
  high: number,
  tolerance: number
): number | null {
  const maxIterations = 100

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2
    const pnl = calculateStrategyPnlAtExpiry(legs, mid)

    if (Math.abs(pnl) < tolerance) {
      return mid
    }

    const lowPnl = calculateStrategyPnlAtExpiry(legs, low)

    if ((lowPnl < 0 && pnl < 0) || (lowPnl > 0 && pnl > 0)) {
      low = mid
    } else {
      high = mid
    }

    if (high - low < tolerance) {
      return (low + high) / 2
    }
  }

  return (low + high) / 2
}

// ============ Max Profit/Loss ============

interface MaxProfitLoss {
  maxProfit: number | "unlimited"
  maxProfitPrice: number | null
  maxLoss: number | "unlimited"
  maxLossPrice: number | null
}

/**
 * Find maximum profit and loss for a strategy
 *
 * @param legs - Array of option legs
 */
export function findMaxProfitLoss(
  legs: SimpleLeg[],
  currentPrice: number
): MaxProfitLoss {
  const strikes = legs.map((l) => l.strike).sort((a, b) => a - b)
  const minStrike = Math.min(...strikes)
  const maxStrike = Math.max(...strikes)

  // Test prices at key points
  const testPrices = [
    0.01, // Near zero
    ...strikes.flatMap((s) => [s * 0.99, s, s * 1.01]), // Around each strike
    maxStrike * 5 // Far above
  ].sort((a, b) => a - b)

  let maxProfit = -Infinity
  let maxProfitPrice: number | null = null
  let minProfit = Infinity
  let minProfitPrice: number | null = null

  for (const price of testPrices) {
    const pnl = calculateStrategyPnlAtExpiry(legs, price)

    if (pnl > maxProfit) {
      maxProfit = pnl
      maxProfitPrice = price
    }
    if (pnl < minProfit) {
      minProfit = pnl
      minProfitPrice = price
    }
  }

  // Check if profit/loss is unlimited
  // Test at extreme prices
  const pnlAtZero = calculateStrategyPnlAtExpiry(legs, 0.01)
  const pnlAtExtreme = calculateStrategyPnlAtExpiry(legs, maxStrike * 100)

  // Check for unlimited upside (buying calls without covering)
  const hasNetLongCalls = legs.some(
    (l) => l.type === "call" && l.action === "buy"
  )
  const hasShortCalls = legs.some(
    (l) => l.type === "call" && l.action === "sell"
  )
  const netLongCallQuantity =
    legs
      .filter((l) => l.type === "call" && l.action === "buy")
      .reduce((sum, l) => sum + l.quantity, 0) -
    legs
      .filter((l) => l.type === "call" && l.action === "sell")
      .reduce((sum, l) => sum + l.quantity, 0)

  // Check for unlimited downside (naked short calls)
  const hasUncoveredShortCalls = hasShortCalls && netLongCallQuantity < 0

  // Check for unlimited loss on naked short calls
  const isUnlimitedProfit = hasNetLongCalls && netLongCallQuantity > 0
  const isUnlimitedLoss = hasUncoveredShortCalls

  return {
    maxProfit: isUnlimitedProfit ? "unlimited" : Math.round(maxProfit * 100) / 100,
    maxProfitPrice: isUnlimitedProfit ? null : maxProfitPrice,
    maxLoss: isUnlimitedLoss ? "unlimited" : Math.round(minProfit * 100) / 100,
    maxLossPrice: isUnlimitedLoss ? null : minProfitPrice
  }
}

// ============ Full Strategy Analysis ============

export interface AnalyzeStrategyParams {
  legs: SimpleLeg[]
  underlyingPrice: number
  btcPrice: number | null
  daysToExpiry: number
  targetPrices?: number[]
}

/**
 * Perform complete analysis of an options strategy
 */
export function analyzeStrategy(params: AnalyzeStrategyParams): StrategyAnalysis {
  const {
    legs,
    underlyingPrice,
    btcPrice,
    daysToExpiry,
    targetPrices = []
  } = params

  // Calculate total cost/credit
  const totalCost = legs.reduce((sum, leg) => {
    const legCost = leg.premium * leg.quantity * 100
    return sum + (leg.action === "buy" ? legCost : -legCost)
  }, 0)

  const totalCostBtc = btcPrice ? usdToBtc(totalCost, btcPrice) : null

  // Find breakevens
  const breakevens = findBreakevens(legs, underlyingPrice, btcPrice)

  // Find max profit/loss
  const { maxProfit, maxProfitPrice, maxLoss, maxLossPrice } = findMaxProfitLoss(
    legs,
    underlyingPrice
  )

  // Calculate current P&L (with time value if possible)
  const currentPnl = calculateStrategyPnlWithTimeValue(
    legs,
    underlyingPrice,
    daysToExpiry
  )
  const currentPnlPercent = totalCost !== 0 ? (currentPnl / Math.abs(totalCost)) * 100 : 0
  const currentPnlBtc = btcPrice ? usdToBtc(currentPnl, btcPrice) : null

  // Calculate P&L at target prices (at expiration)
  const targetPnls: PnLPoint[] = targetPrices.map((price) => {
    const pnl = calculateStrategyPnlAtExpiry(legs, price)
    return {
      price,
      btcPrice: btcPrice
        ? strikeToEquivalentBtcPrice(price, underlyingPrice, btcPrice)
        : null,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: totalCost !== 0 ? (pnl / Math.abs(totalCost)) * 100 : 0,
      pnlBtc: btcPrice ? usdToBtc(pnl, btcPrice) : null
    }
  })

  // Sum Greeks
  const totalDelta = legs.reduce((sum, leg) => {
    // Delta needs to be adjusted for buy/sell
    const legDelta = (leg.iv !== null && leg.iv > 0)
      ? calculateLegDelta(leg, underlyingPrice, daysToExpiry)
      : 0
    return sum + legDelta
  }, 0)

  const totalGamma = legs.reduce((sum, leg) => {
    // Gamma is always positive, but negative for short positions
    return sum // Simplified - would need full Greeks calculation
  }, 0)

  const totalVega = legs.reduce((sum, leg) => {
    return sum // Simplified
  }, 0)

  const totalTheta = legs.reduce((sum, leg) => {
    return sum // Simplified
  }, 0)

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalCostBtc,
    maxProfit,
    maxProfitPrice,
    maxLoss,
    maxLossPrice,
    breakevens,
    currentPnl: Math.round(currentPnl * 100) / 100,
    currentPnlPercent: Math.round(currentPnlPercent * 100) / 100,
    currentPnlBtc,
    targetPnls,
    daysToExpiry,
    theta: totalTheta,
    totalDelta: Math.round(totalDelta * 1000) / 1000,
    totalGamma,
    totalVega
  }
}

// ============ Helper Functions ============

/**
 * Calculate delta for a single leg
 */
function calculateLegDelta(
  leg: SimpleLeg,
  currentPrice: number,
  daysToExpiry: number
): number {
  if (leg.iv === null || leg.iv <= 0 || daysToExpiry <= 0) {
    // At expiration, delta is 0 or 1
    const isItm =
      leg.type === "call"
        ? currentPrice > leg.strike
        : currentPrice < leg.strike
    const baseDelta = isItm ? (leg.type === "call" ? 1 : -1) : 0
    const sign = leg.action === "buy" ? 1 : -1
    return baseDelta * leg.quantity * sign
  }

  // Approximate delta based on moneyness and IV
  // Full calculation would use Black-Scholes
  const timeToExpiry = daysToYears(daysToExpiry)
  const moneyness = currentPrice / leg.strike

  let delta: number
  if (leg.type === "call") {
    if (moneyness > 1.1) delta = 0.9
    else if (moneyness > 1.05) delta = 0.7
    else if (moneyness > 0.95) delta = 0.5
    else if (moneyness > 0.9) delta = 0.3
    else delta = 0.1
  } else {
    if (moneyness < 0.9) delta = -0.9
    else if (moneyness < 0.95) delta = -0.7
    else if (moneyness < 1.05) delta = -0.5
    else if (moneyness < 1.1) delta = -0.3
    else delta = -0.1
  }

  const sign = leg.action === "buy" ? 1 : -1
  return delta * leg.quantity * sign * 100
}

/**
 * Calculate total cost for opening a strategy
 */
export function calculateTotalCost(legs: SimpleLeg[]): number {
  return legs.reduce((sum, leg) => {
    const legCost = leg.premium * leg.quantity * 100
    return sum + (leg.action === "buy" ? legCost : -legCost)
  }, 0)
}

/**
 * Generate an array of prices for P&L curve
 */
export function generatePriceRange(
  currentPrice: number,
  legs: SimpleLeg[],
  numPoints: number = 50
): number[] {
  const strikes = legs.map((l) => l.strike)
  const minStrike = Math.min(...strikes, currentPrice)
  const maxStrike = Math.max(...strikes, currentPrice)

  // Range from 50% below min to 50% above max
  const rangeMin = Math.max(0.01, minStrike * 0.5)
  const rangeMax = maxStrike * 1.5

  const step = (rangeMax - rangeMin) / (numPoints - 1)
  const prices: number[] = []

  for (let i = 0; i < numPoints; i++) {
    prices.push(rangeMin + step * i)
  }

  return prices
}
