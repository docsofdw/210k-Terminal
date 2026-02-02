/**
 * Black-Scholes Option Pricing Model
 *
 * TypeScript implementation of the Black-Scholes model for
 * option pricing and Greeks calculations.
 *
 * Mathematical formulas:
 * - d1 = (ln(S/K) + (r + σ²/2)T) / (σ√T)
 * - d2 = d1 - σ√T
 * - Call = S*N(d1) - K*e^(-rT)*N(d2)
 * - Put = K*e^(-rT)*N(-d2) - S*N(-d1)
 *
 * Where:
 * - S = spot price
 * - K = strike price
 * - T = time to expiry (years)
 * - r = risk-free rate
 * - σ = volatility
 * - N() = cumulative normal distribution
 */

import type { OptionType } from "@/types/derivatives"

// ============ Normal Distribution ============

/**
 * Standard normal probability density function (PDF)
 * φ(x) = (1/√2π) * e^(-x²/2)
 */
export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

/**
 * Standard normal cumulative distribution function (CDF)
 * Uses Abramowitz & Stegun approximation (error < 7.5e-8)
 *
 * N(x) = 1 - φ(x)(b₁t + b₂t² + b₃t³ + b₄t⁴ + b₅t⁵)
 * where t = 1/(1 + px)
 */
export function normalCdf(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  // Handle symmetry: N(-x) = 1 - N(x)
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)

  const t = 1.0 / (1.0 + p * x)
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2)

  return 0.5 * (1.0 + sign * y)
}

// ============ Black-Scholes Core ============

export interface D1D2Result {
  d1: number
  d2: number
}

/**
 * Calculate d1 and d2 parameters for Black-Scholes
 *
 * @param spot - Current underlying price
 * @param strike - Strike price
 * @param time - Time to expiry in years
 * @param rate - Risk-free interest rate (e.g., 0.05 for 5%)
 * @param vol - Volatility (e.g., 0.30 for 30%)
 */
export function calculateD1D2(
  spot: number,
  strike: number,
  time: number,
  rate: number,
  vol: number
): D1D2Result | null {
  // Guard against invalid inputs
  if (spot <= 0 || strike <= 0 || time <= 0 || vol <= 0) {
    return null
  }

  const sqrtTime = Math.sqrt(time)
  const d1 =
    (Math.log(spot / strike) + (rate + (vol * vol) / 2) * time) /
    (vol * sqrtTime)
  const d2 = d1 - vol * sqrtTime

  return { d1, d2 }
}

/**
 * Calculate option price using Black-Scholes formula
 *
 * @param spot - Current underlying price
 * @param strike - Strike price
 * @param time - Time to expiry in years
 * @param rate - Risk-free interest rate
 * @param vol - Volatility
 * @param type - "call" or "put"
 */
export function priceOption(
  spot: number,
  strike: number,
  time: number,
  rate: number,
  vol: number,
  type: OptionType
): number | null {
  // At expiration, return intrinsic value
  if (time <= 0) {
    if (type === "call") {
      return Math.max(0, spot - strike)
    } else {
      return Math.max(0, strike - spot)
    }
  }

  const params = calculateD1D2(spot, strike, time, rate, vol)
  if (!params) return null

  const { d1, d2 } = params
  const discountFactor = Math.exp(-rate * time)

  if (type === "call") {
    return spot * normalCdf(d1) - strike * discountFactor * normalCdf(d2)
  } else {
    return strike * discountFactor * normalCdf(-d2) - spot * normalCdf(-d1)
  }
}

// ============ Greeks ============

export interface Greeks {
  delta: number // Rate of change of option price with respect to underlying
  gamma: number // Rate of change of delta
  theta: number // Time decay (per day)
  vega: number // Sensitivity to volatility (per 1% change)
  rho: number // Sensitivity to interest rate
}

/**
 * Calculate option Greeks
 *
 * @param spot - Current underlying price
 * @param strike - Strike price
 * @param time - Time to expiry in years
 * @param rate - Risk-free interest rate
 * @param vol - Volatility
 * @param type - "call" or "put"
 */
export function calculateGreeks(
  spot: number,
  strike: number,
  time: number,
  rate: number,
  vol: number,
  type: OptionType
): Greeks | null {
  // At or past expiration
  if (time <= 0) {
    const isItm =
      type === "call" ? spot > strike : spot < strike

    return {
      delta: isItm ? (type === "call" ? 1 : -1) : 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0
    }
  }

  const params = calculateD1D2(spot, strike, time, rate, vol)
  if (!params) return null

  const { d1, d2 } = params
  const sqrtTime = Math.sqrt(time)
  const discountFactor = Math.exp(-rate * time)
  const pdf_d1 = normalPdf(d1)

  // Delta
  let delta: number
  if (type === "call") {
    delta = normalCdf(d1)
  } else {
    delta = normalCdf(d1) - 1
  }

  // Gamma (same for calls and puts)
  const gamma = pdf_d1 / (spot * vol * sqrtTime)

  // Theta (per year, we'll convert to per day)
  let theta: number
  const term1 = (-spot * pdf_d1 * vol) / (2 * sqrtTime)
  if (type === "call") {
    theta =
      term1 - rate * strike * discountFactor * normalCdf(d2)
  } else {
    theta =
      term1 + rate * strike * discountFactor * normalCdf(-d2)
  }
  // Convert to daily theta
  theta = theta / 365

  // Vega (per 1% change in vol)
  const vega = (spot * sqrtTime * pdf_d1) / 100

  // Rho (per 1% change in rate)
  let rho: number
  if (type === "call") {
    rho = (strike * time * discountFactor * normalCdf(d2)) / 100
  } else {
    rho = (-strike * time * discountFactor * normalCdf(-d2)) / 100
  }

  return {
    delta,
    gamma,
    theta,
    vega,
    rho
  }
}

// ============ Implied Volatility ============

/**
 * Calculate implied volatility using Newton-Raphson method
 *
 * @param marketPrice - Observed market price of the option
 * @param spot - Current underlying price
 * @param strike - Strike price
 * @param time - Time to expiry in years
 * @param rate - Risk-free interest rate
 * @param type - "call" or "put"
 * @param maxIterations - Maximum iterations (default 100)
 * @param tolerance - Convergence tolerance (default 0.0001)
 */
export function impliedVolatility(
  marketPrice: number,
  spot: number,
  strike: number,
  time: number,
  rate: number,
  type: OptionType,
  maxIterations: number = 100,
  tolerance: number = 0.0001
): number | null {
  // Initial guess using Brenner-Subrahmanyam approximation
  let vol = Math.sqrt((2 * Math.PI) / time) * (marketPrice / spot)
  vol = Math.max(0.01, Math.min(vol, 5)) // Clamp between 1% and 500%

  for (let i = 0; i < maxIterations; i++) {
    const price = priceOption(spot, strike, time, rate, vol, type)
    if (price === null) return null

    const diff = price - marketPrice

    // Check for convergence
    if (Math.abs(diff) < tolerance) {
      return vol
    }

    // Calculate vega for Newton-Raphson step
    const greeks = calculateGreeks(spot, strike, time, rate, vol, type)
    if (!greeks || greeks.vega === 0) {
      // If vega is zero, try bisection step
      vol = diff > 0 ? vol * 0.9 : vol * 1.1
      continue
    }

    // Newton-Raphson: vol_new = vol - f(vol) / f'(vol)
    // Note: vega is already per 1%, so multiply by 100
    const vegaFull = greeks.vega * 100
    vol = vol - diff / vegaFull

    // Keep vol in reasonable bounds
    vol = Math.max(0.001, Math.min(vol, 10))
  }

  // Failed to converge
  return null
}

// ============ Utility Functions ============

/**
 * Convert days to years
 */
export function daysToYears(days: number): number {
  return days / 365
}

/**
 * Get the current risk-free rate (approximation)
 * In production, this would fetch from treasury yields
 */
export function getRiskFreeRate(): number {
  return 0.05 // 5% default
}
