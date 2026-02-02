/**
 * OCC Option Symbol Parser
 *
 * Parses Options Clearing Corporation (OCC) standardized option symbols
 * to extract underlying, expiration, type, and strike price.
 *
 * OCC Format: ROOT YYMMDD C/P STRIKE
 * Example: IBIT  250221C00055000
 *          │     │     │└─────── Strike × 1000 (55.000)
 *          │     │     └──────── Type (C=Call, P=Put)
 *          │     └────────────── Expiration (YYMMDD)
 *          └──────────────────── Underlying (1-6 chars, space-padded to 6)
 */

import type { ParsedOption, ParsedEquity, ParsedSymbol } from "@/types/clear-street"

/**
 * Parse an OCC option symbol into its components
 *
 * @param symbol - The OCC symbol (e.g., "IBIT  250221C00055000" or "O:IBIT250221C00055000")
 * @returns Parsed option details or null if not a valid option symbol
 */
export function parseOccSymbol(symbol: string): ParsedOption | null {
  if (!symbol || typeof symbol !== "string") {
    return null
  }

  // Remove common prefixes (O: from Polygon, etc.)
  let cleanSymbol = symbol.trim()
  if (cleanSymbol.startsWith("O:")) {
    cleanSymbol = cleanSymbol.slice(2)
  }

  // OCC symbols are exactly 21 characters when properly formatted
  // But Clear Street may return them with or without padding
  // Format: SYMBOL(1-6) + YYMMDD(6) + C/P(1) + STRIKE(8)

  // Try multiple regex patterns to handle variations

  // Pattern 1: Standard OCC with possible spaces (e.g., "IBIT  250221C00055000")
  const standardMatch = cleanSymbol.match(
    /^([A-Z]{1,6})\s*(\d{6})([CP])(\d{8})$/
  )

  if (standardMatch) {
    const [, underlying, dateStr, typeChar, strikeStr] = standardMatch
    return parseComponents(underlying, dateStr, typeChar, strikeStr)
  }

  // Pattern 2: Compact format without spaces (e.g., "IBIT250221C00055000")
  const compactMatch = cleanSymbol.match(
    /^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/
  )

  if (compactMatch) {
    const [, underlying, dateStr, typeChar, strikeStr] = compactMatch
    return parseComponents(underlying, dateStr, typeChar, strikeStr)
  }

  // Pattern 3: With decimal strike (some formats use this)
  const decimalMatch = cleanSymbol.match(
    /^([A-Z]{1,6})\s*(\d{6})([CP])(\d+\.?\d*)$/
  )

  if (decimalMatch) {
    const [, underlying, dateStr, typeChar, strikeStr] = decimalMatch
    const strike = parseFloat(strikeStr)
    if (isNaN(strike)) return null

    const year = 2000 + parseInt(dateStr.slice(0, 2))
    const month = dateStr.slice(2, 4)
    const day = dateStr.slice(4, 6)

    return {
      underlying: underlying.trim(),
      expiration: `${year}-${month}-${day}`,
      type: typeChar === "C" ? "call" : "put",
      strike,
      isOption: true
    }
  }

  return null
}

/**
 * Parse the extracted components into a ParsedOption object
 */
function parseComponents(
  underlying: string,
  dateStr: string,
  typeChar: string,
  strikeStr: string
): ParsedOption | null {
  // Parse expiration date (YYMMDD)
  const year = 2000 + parseInt(dateStr.slice(0, 2))
  const month = dateStr.slice(2, 4)
  const day = dateStr.slice(4, 6)

  // Validate date components
  const monthNum = parseInt(month)
  const dayNum = parseInt(day)
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    return null
  }

  const expiration = `${year}-${month}-${day}`

  // Parse strike price (divide by 1000 for standard 8-digit format)
  // Standard OCC: 8 digits with 3 implied decimals (00055000 = 55.000)
  const strike = parseInt(strikeStr) / 1000

  if (isNaN(strike) || strike <= 0) {
    return null
  }

  return {
    underlying: underlying.trim(),
    expiration,
    type: typeChar === "C" ? "call" : "put",
    strike,
    isOption: true
  }
}

/**
 * Parse a symbol and determine if it's an option or equity
 *
 * @param symbol - The symbol to parse
 * @returns ParsedSymbol (either ParsedOption or ParsedEquity)
 */
export function parseSymbol(symbol: string): ParsedSymbol {
  const option = parseOccSymbol(symbol)

  if (option) {
    return option
  }

  // Not an option, treat as equity
  return {
    symbol: symbol.trim().toUpperCase(),
    isOption: false
  }
}

/**
 * Format a strike price for display
 *
 * @param strike - The strike price
 * @returns Formatted string (e.g., "55.00" or "550.00")
 */
export function formatStrike(strike: number): string {
  // Use 2 decimal places for most strikes, but handle whole numbers
  if (strike === Math.floor(strike)) {
    return strike.toFixed(0)
  }
  return strike.toFixed(2)
}

/**
 * Format an expiration date for display
 *
 * @param expiration - ISO date string (YYYY-MM-DD)
 * @returns Formatted string (e.g., "Feb 21, 2025")
 */
export function formatExpiration(expiration: string): string {
  const date = new Date(expiration + "T00:00:00")
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })
}

/**
 * Format an expiration date in short form
 *
 * @param expiration - ISO date string (YYYY-MM-DD)
 * @returns Formatted string (e.g., "2/21/25")
 */
export function formatExpirationShort(expiration: string): string {
  const date = new Date(expiration + "T00:00:00")
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit"
  })
}

/**
 * Create a display name for an option position
 *
 * @param parsed - Parsed option details
 * @returns Display string (e.g., "IBIT Feb 21 $55 Call")
 */
export function formatOptionDisplay(parsed: ParsedOption): string {
  const expDate = new Date(parsed.expiration + "T00:00:00")
  const month = expDate.toLocaleDateString("en-US", { month: "short" })
  const day = expDate.getDate()
  const typeLabel = parsed.type === "call" ? "Call" : "Put"

  return `${parsed.underlying} ${month} ${day} $${formatStrike(parsed.strike)} ${typeLabel}`
}

/**
 * Calculate days until expiration
 *
 * @param expiration - ISO date string (YYYY-MM-DD)
 * @returns Number of days until expiration (0 if expired)
 */
export function daysToExpiration(expiration: string): number {
  const expDate = new Date(expiration + "T23:59:59")
  const now = new Date()
  const diffMs = expDate.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, days)
}

/**
 * Check if an option is expired
 *
 * @param expiration - ISO date string (YYYY-MM-DD)
 * @returns true if expired
 */
export function isExpired(expiration: string): boolean {
  return daysToExpiration(expiration) === 0
}

/**
 * Build an OCC symbol from components
 *
 * @param underlying - The underlying symbol (e.g., "IBIT")
 * @param expiration - ISO date string (YYYY-MM-DD)
 * @param type - "call" or "put"
 * @param strike - Strike price
 * @returns OCC symbol string
 */
export function buildOccSymbol(
  underlying: string,
  expiration: string,
  type: "call" | "put",
  strike: number
): string {
  // Pad underlying to 6 characters
  const paddedUnderlying = underlying.toUpperCase().padEnd(6, " ")

  // Format date as YYMMDD
  const [year, month, day] = expiration.split("-")
  const dateStr = year.slice(2) + month + day

  // Type character
  const typeChar = type === "call" ? "C" : "P"

  // Strike as 8-digit integer (multiply by 1000)
  const strikeInt = Math.round(strike * 1000)
  const strikeStr = strikeInt.toString().padStart(8, "0")

  return `${paddedUnderlying}${dateStr}${typeChar}${strikeStr}`
}
