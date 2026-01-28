/**
 * Currency utilities for stock price adjustments
 */

// Currency symbols for display
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  CAD: "C$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  HKD: "HK$",
  AUD: "A$",
  BRL: "R$",
  THB: "฿",
  KRW: "₩"
}

/**
 * LSE stocks are quoted in pence (0.01 GBP), this converts to GBP
 * Yahoo Finance returns LSE prices in pence for stocks ending in .L
 */
export function adjustForPence(price: number, yahooTicker: string): number {
  if (yahooTicker.endsWith(".L")) {
    return price / 100
  }
  return price
}

/**
 * Adjust a quote object for LSE pence pricing
 */
export function adjustQuoteForPence(
  quote: {
    price: number
    open: number | null
    high: number | null
    low: number | null
    previousClose: number | null
  },
  yahooTicker: string
): {
  price: number
  open: number | null
  high: number | null
  low: number | null
  previousClose: number | null
} {
  if (!yahooTicker.endsWith(".L")) {
    return quote
  }

  return {
    price: quote.price / 100,
    open: quote.open !== null ? quote.open / 100 : null,
    high: quote.high !== null ? quote.high / 100 : null,
    low: quote.low !== null ? quote.low / 100 : null,
    previousClose: quote.previousClose !== null ? quote.previousClose / 100 : null
  }
}

/**
 * Format a price for display based on currency
 * Some currencies (JPY, KRW) don't use decimal places
 */
export function formatPrice(value: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || ""

  if (currency === "JPY" || currency === "KRW") {
    return `${symbol}${Math.round(value).toLocaleString()}`
  }

  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}
