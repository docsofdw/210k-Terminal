/**
 * Unified Market Data Service
 *
 * Routes requests to the appropriate API based on exchange/ticker:
 * - US stocks -> MarketData.app (dedicated financial API, better rate limits)
 * - International stocks -> Yahoo Finance (supports .T, .HK, .L, etc.)
 *
 * Provides a normalized interface for all market data regardless of source.
 */

import * as marketdata from "@/lib/api/marketdata"
import * as twelvedata from "@/lib/api/twelve-data"
import * as yahoo from "@/lib/api/yahoo-finance"

// ============ Types ============

export type DataProvider = "marketdata" | "twelvedata" | "yahoo"

export interface NormalizedQuote {
  symbol: string
  name: string | null
  price: number
  change: number
  changePercent: number
  volume: number
  open: number
  high: number
  low: number
  previousClose: number
  week52High: number | null
  week52Low: number | null
  marketCap: number | null
  sharesOutstanding: number | null
  currency: string
  exchange: string
  provider: DataProvider
  updatedAt: Date
}

export interface NormalizedFundamentals {
  symbol: string
  marketCap: number | null
  sharesOutstanding: number | null
  dilutedShares: number | null
  cashAndEquivalents: number | null
  totalDebt: number | null
  fiscalDate: string | null
  provider: DataProvider
  updatedAt: Date
}

export interface CompanyTicker {
  ticker: string
  exchange?: string | null
}

// ============ Exchange Detection ============

// US exchanges that use MarketData.app
const US_EXCHANGES = [
  "NYSE",
  "NASDAQ",
  "AMEX",
  "NYSEARCA",
  "BATS",
  "CBOE",
  "ARCA",
  "NYQ",
  "NMS",
  "NGM",
  "PCX"
]

// International ticker suffixes -> Twelve Data
const INTERNATIONAL_SUFFIXES = [
  ".T",    // Tokyo
  ".HK",   // Hong Kong
  ".L",    // London
  ".V",    // TSX Venture
  ".TO",   // Toronto
  ".AX",   // Australia
  ".SA",   // Brazil
  ".BK",   // Thailand
  ".KQ",   // Korea KOSDAQ
  ".KS",   // Korea KOSPI
  ".PA",   // Paris
  ".HM",   // Hamburg
  ".DE",   // Germany XETRA
  ".AQ",   // Aquis UK
  ".SW",   // Swiss
  ".AS",   // Amsterdam
  ".MI",   // Milan
  ".OL",   // Oslo
  ".ST",   // Stockholm
  ".CO",   // Copenhagen
  ".HE",   // Helsinki
]

/**
 * Determine which API provider to use for a given ticker
 *
 * - US stocks (no suffix, US exchange) -> MarketData.app
 * - International stocks (.T, .HK, .L, etc.) -> Yahoo Finance
 *   (Twelve Data doesn't support Yahoo-style international symbols)
 */
export function getProvider(ticker: string, exchange?: string | null): DataProvider {
  // Check for international suffix first -> use Yahoo Finance
  const upperTicker = ticker.toUpperCase()
  for (const suffix of INTERNATIONAL_SUFFIXES) {
    if (upperTicker.endsWith(suffix.toUpperCase())) {
      return "yahoo"
    }
  }

  // Check exchange if provided
  if (exchange) {
    const upperExchange = exchange.toUpperCase()
    if (US_EXCHANGES.some(e => upperExchange.includes(e))) {
      return "marketdata"
    }
    // Non-US exchange -> use Yahoo Finance
    return "yahoo"
  }

  // Default: assume US if no suffix and no exchange info
  return "marketdata"
}

/**
 * Split tickers into US (MarketData.app) and international (Yahoo Finance) groups
 */
export function splitTickersByProvider(
  tickers: CompanyTicker[]
): { us: string[]; international: string[] } {
  const us: string[] = []
  const international: string[] = []

  for (const { ticker, exchange } of tickers) {
    const provider = getProvider(ticker, exchange)
    if (provider === "marketdata") {
      us.push(ticker)
    } else {
      // Both "yahoo" and "twelvedata" go to international (we use Yahoo for both now)
      international.push(ticker)
    }
  }

  return { us, international }
}

// ============ Quote Fetching ============

/**
 * Fetch a single quote from the appropriate provider
 */
export async function fetchQuote(
  ticker: string,
  exchange?: string | null
): Promise<NormalizedQuote | null> {
  const provider = getProvider(ticker, exchange)

  if (provider === "marketdata") {
    const quote = await marketdata.getQuote(ticker)
    if (!quote) return null
    return normalizeMarketDataQuote(quote)
  } else if (provider === "yahoo") {
    const quote = await yahoo.getStockQuote(ticker)
    if (!quote) return null
    return normalizeYahooQuote(quote)
  } else {
    // Fallback to Twelve Data (for US stocks if MarketData fails)
    const quote = await twelvedata.getQuote(ticker)
    if (!quote) return null
    return normalizeTwelveDataQuote(quote)
  }
}

/**
 * Fetch quotes for multiple tickers in batch
 * Automatically routes to correct APIs and merges results:
 * - US stocks -> MarketData.app
 * - International stocks -> Yahoo Finance
 */
export async function fetchQuotesBatch(
  tickers: CompanyTicker[]
): Promise<Map<string, NormalizedQuote>> {
  const { us, international } = splitTickersByProvider(tickers)
  const results = new Map<string, NormalizedQuote>()

  // Fetch from both APIs in parallel
  const [marketdataQuotes, yahooQuotes] = await Promise.all([
    us.length > 0 ? marketdata.getQuotesBatch(us) : new Map(),
    international.length > 0 ? yahoo.getMultipleQuotes(international) : new Map()
  ])

  // Normalize and merge MarketData quotes (US stocks)
  for (const [symbol, quote] of marketdataQuotes) {
    results.set(symbol, normalizeMarketDataQuote(quote))
  }

  // Normalize and merge Yahoo Finance quotes (international stocks)
  for (const [symbol, quote] of yahooQuotes) {
    results.set(symbol, normalizeYahooQuote(quote))
  }

  return results
}

// ============ Fundamentals Fetching ============

/**
 * Fetch fundamental data (balance sheet) for a ticker
 * Note: This is expensive (100 credits on Twelve Data), use sparingly
 */
export async function fetchFundamentals(
  ticker: string,
  exchange?: string | null
): Promise<NormalizedFundamentals | null> {
  const provider = getProvider(ticker, exchange)

  if (provider === "marketdata") {
    // MarketData.app doesn't have detailed fundamentals in basic tier
    // Return what we can from the quote
    const quote = await marketdata.getQuote(ticker)
    if (!quote) return null

    return {
      symbol: quote.symbol,
      marketCap: quote.marketCap,
      sharesOutstanding: quote.sharesOutstanding,
      dilutedShares: null, // Not available from MarketData quote
      cashAndEquivalents: null,
      totalDebt: null,
      fiscalDate: null,
      provider: "marketdata",
      updatedAt: new Date()
    }
  } else {
    // Fetch balance sheet from Twelve Data
    const [stats, balanceSheet] = await Promise.all([
      twelvedata.getStatistics(ticker),
      twelvedata.getBalanceSheet(ticker, "quarterly")
    ])

    const latestBS = balanceSheet?.balanceSheet?.[0]

    return {
      symbol: ticker,
      marketCap: stats?.marketCapitalization || null,
      sharesOutstanding: stats?.sharesOutstanding || null,
      dilutedShares: latestBS?.commonStockSharesOutstanding || null,
      cashAndEquivalents: latestBS?.cashAndCashEquivalents || null,
      totalDebt: latestBS?.totalDebt || null,
      fiscalDate: latestBS?.fiscalDate || null,
      provider: "twelvedata",
      updatedAt: new Date()
    }
  }
}

/**
 * Fetch fundamentals for multiple tickers
 * Note: Rate limited due to API credit costs
 * @param delayMs - Delay between requests to avoid rate limits
 */
export async function fetchFundamentalsBatch(
  tickers: CompanyTicker[],
  delayMs: number = 8000 // 8 seconds for Twelve Data fundamentals rate limit
): Promise<Map<string, NormalizedFundamentals>> {
  const results = new Map<string, NormalizedFundamentals>()

  for (const { ticker, exchange } of tickers) {
    const fundamentals = await fetchFundamentals(ticker, exchange)
    if (fundamentals) {
      results.set(ticker, fundamentals)
    }

    // Rate limit delay
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  return results
}

// ============ Technicals ============

/**
 * Fetch technical indicators (52-week high, 200D avg)
 */
export async function fetchTechnicals(
  ticker: string,
  exchange?: string | null
): Promise<{ week52High: number; avg200d: number } | null> {
  const provider = getProvider(ticker, exchange)

  if (provider === "marketdata") {
    return marketdata.getTechnicals(ticker)
  } else {
    return twelvedata.getTechnicals(ticker)
  }
}

// ============ Normalization Helpers ============

function normalizeMarketDataQuote(quote: marketdata.MarketDataQuote): NormalizedQuote {
  return {
    symbol: quote.symbol,
    name: quote.name,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    volume: quote.volume,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    previousClose: quote.previousClose,
    week52High: quote.week52High,
    week52Low: quote.week52Low,
    marketCap: quote.marketCap,
    sharesOutstanding: quote.sharesOutstanding,
    currency: "USD",
    exchange: "US",
    provider: "marketdata",
    updatedAt: quote.updated
  }
}

function normalizeTwelveDataQuote(quote: twelvedata.NormalizedTwelveDataQuote): NormalizedQuote {
  return {
    symbol: quote.symbol,
    name: quote.name,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    volume: quote.volume,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    previousClose: quote.previousClose,
    week52High: quote.week52High,
    week52Low: quote.week52Low,
    marketCap: null, // Need to fetch from statistics endpoint
    sharesOutstanding: null,
    currency: quote.currency,
    exchange: quote.exchange,
    provider: "twelvedata",
    updatedAt: quote.updated
  }
}

function normalizeYahooQuote(quote: yahoo.StockQuote): NormalizedQuote {
  // Calculate change percent if we have previous close
  const changePercent = quote.previousClose && quote.previousClose > 0
    ? ((quote.price - quote.previousClose) / quote.previousClose) * 100
    : 0

  return {
    symbol: quote.symbol,
    name: null, // Yahoo doesn't return name in quote
    price: quote.price,
    change: quote.previousClose ? quote.price - quote.previousClose : 0,
    changePercent,
    volume: quote.volume || 0,
    open: quote.open || quote.price,
    high: quote.high || quote.price,
    low: quote.low || quote.price,
    previousClose: quote.previousClose || 0,
    week52High: null, // Would need separate call
    week52Low: null,
    marketCap: quote.marketCap,
    sharesOutstanding: null,
    currency: quote.currency,
    exchange: quote.exchange,
    provider: "yahoo",
    updatedAt: quote.timestamp
  }
}

// ============ Status Checks ============

/**
 * Check if market data services are configured
 * Note: Yahoo Finance doesn't require API key
 */
export function getServiceStatus(): {
  marketdata: boolean
  twelvedata: boolean
  yahoo: boolean
  configured: boolean
} {
  const md = marketdata.isMarketDataConfigured()
  const td = twelvedata.isTwelveDataConfigured()

  return {
    marketdata: md,
    twelvedata: td,
    yahoo: true, // Yahoo Finance doesn't require configuration
    configured: true // Always configured since Yahoo Finance works without API key
  }
}
