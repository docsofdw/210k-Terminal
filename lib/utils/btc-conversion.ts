/**
 * BTC Conversion Utilities
 *
 * Utilities for converting between USD and BTC, calculating
 * BTC-equivalent values for options strategies on BTC proxies.
 */

// ============ Basic Conversions ============

/**
 * Convert USD amount to BTC
 *
 * @param usd - Amount in USD
 * @param btcPrice - Current BTC price in USD
 */
export function usdToBtc(usd: number, btcPrice: number): number {
  if (btcPrice <= 0) return 0
  return usd / btcPrice
}

/**
 * Convert BTC amount to USD
 *
 * @param btc - Amount in BTC
 * @param btcPrice - Current BTC price in USD
 */
export function btcToUsd(btc: number, btcPrice: number): number {
  return btc * btcPrice
}

/**
 * Get BTC equivalent per share of an asset
 * Useful for understanding how much BTC exposure a share represents
 *
 * @param sharePrice - Current share price in USD
 * @param btcPrice - Current BTC price in USD
 */
export function getBtcPerShare(sharePrice: number, btcPrice: number): number {
  if (btcPrice <= 0) return 0
  return sharePrice / btcPrice
}

// ============ Strike Price Conversions ============

/**
 * Calculate the equivalent BTC price for when an option strike is hit
 *
 * This answers: "At what BTC price does this strike become ATM?"
 *
 * Uses the ratio between the current share price and BTC price
 * to project what BTC would be at a given strike.
 *
 * @param strike - Option strike price
 * @param currentSharePrice - Current price of the underlying
 * @param currentBtcPrice - Current BTC price
 */
export function strikeToEquivalentBtcPrice(
  strike: number,
  currentSharePrice: number,
  currentBtcPrice: number
): number {
  if (currentSharePrice <= 0) return 0

  // Ratio: how much does share price move per $1 BTC move
  const ratio = currentSharePrice / currentBtcPrice

  // At what BTC price would the share be at this strike?
  // strike = ratio * btcPrice
  // btcPrice = strike / ratio
  return strike / ratio
}

/**
 * Calculate the equivalent strike for a target BTC price
 *
 * This answers: "If I want exposure to BTC at $X, what strike should I pick?"
 *
 * @param targetBtcPrice - Target BTC price
 * @param currentSharePrice - Current price of the underlying
 * @param currentBtcPrice - Current BTC price
 */
export function btcPriceToStrike(
  targetBtcPrice: number,
  currentSharePrice: number,
  currentBtcPrice: number
): number {
  if (currentBtcPrice <= 0) return 0

  const ratio = currentSharePrice / currentBtcPrice
  return targetBtcPrice * ratio
}

// ============ Formatting ============

/**
 * Format a BTC amount with appropriate precision
 *
 * @param amount - BTC amount
 * @param precision - Number of decimal places (default: 8 for sats precision)
 */
export function formatBtc(amount: number, precision: number = 8): string {
  if (Math.abs(amount) >= 1) {
    // For amounts >= 1 BTC, show 4 decimals
    return amount.toFixed(4)
  } else if (Math.abs(amount) >= 0.001) {
    // For amounts between 0.001 and 1, show 6 decimals
    return amount.toFixed(6)
  } else {
    // For tiny amounts, show full precision
    return amount.toFixed(precision)
  }
}

/**
 * Format a BTC amount with symbol
 *
 * @param amount - BTC amount
 */
export function formatBtcWithSymbol(amount: number): string {
  return `₿${formatBtc(amount)}`
}

/**
 * Convert BTC to satoshis
 *
 * @param btc - Amount in BTC
 */
export function btcToSats(btc: number): number {
  return Math.round(btc * 100_000_000)
}

/**
 * Convert satoshis to BTC
 *
 * @param sats - Amount in satoshis
 */
export function satsToBtc(sats: number): number {
  return sats / 100_000_000
}

/**
 * Format satoshis
 *
 * @param sats - Amount in satoshis
 */
export function formatSats(sats: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(sats))
}

// ============ Analysis Helpers ============

/**
 * Calculate the BTC-equivalent P&L
 *
 * @param pnlUsd - P&L in USD
 * @param btcPrice - Current BTC price
 */
export function pnlToBtc(pnlUsd: number, btcPrice: number): number {
  return usdToBtc(pnlUsd, btcPrice)
}

/**
 * Calculate BTC exposure for a position
 *
 * @param shares - Number of shares
 * @param sharePrice - Price per share
 * @param btcPrice - Current BTC price
 */
export function calculateBtcExposure(
  shares: number,
  sharePrice: number,
  btcPrice: number
): number {
  const totalValue = shares * sharePrice
  return usdToBtc(totalValue, btcPrice)
}

/**
 * Calculate the delta-adjusted BTC exposure for an option position
 *
 * @param contracts - Number of contracts (each = 100 shares)
 * @param delta - Option delta
 * @param sharePrice - Current underlying price
 * @param btcPrice - Current BTC price
 */
export function calculateOptionBtcExposure(
  contracts: number,
  delta: number,
  sharePrice: number,
  btcPrice: number
): number {
  const shares = contracts * 100 * Math.abs(delta)
  return calculateBtcExposure(shares, sharePrice, btcPrice)
}
