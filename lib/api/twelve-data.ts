/**
 * Twelve Data API Integration
 *
 * Pricing: ~$79/month (Pro plan)
 * Rate limit: 800 requests/minute, 8 requests/minute for fundamentals
 * Coverage: 50+ global exchanges (TSE, HKEX, LSE, TSX, B3, ASX, SET, KOSDAQ, etc.)
 *
 * Used for: International stock quotes, fundamentals (balance sheet, shares)
 *
 * Sign up: https://twelvedata.com/
 * Docs: https://twelvedata.com/docs
 */

const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com"

// ============ Types ============

export interface TwelveDataQuote {
  symbol: string
  name: string
  exchange: string
  micCode: string
  currency: string
  datetime: string
  timestamp: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  previousClose: string
  change: string
  percentChange: string
  fiftyTwoWeek: {
    low: string
    high: string
    lowChange: string
    highChange: string
    lowChangePercent: string
    highChangePercent: string
    range: string
  }
  isMarketOpen: boolean
}

export interface TwelveDataStatistics {
  symbol: string
  name: string
  exchange: string
  marketCapitalization: number | null
  sharesOutstanding: number | null
  floatShares: number | null
  // Additional fields from statistics endpoint
  statistics: {
    valuations_metrics?: {
      market_capitalization?: number
    }
    stock_statistics?: {
      shares_outstanding?: number
      float_shares?: number
    }
  }
}

export interface TwelveDataBalanceSheet {
  symbol: string
  balanceSheet: Array<{
    fiscalDate: string
    // Assets
    cashAndCashEquivalents: number | null
    totalCurrentAssets: number | null
    totalAssets: number | null
    // Liabilities
    totalDebt: number | null
    longTermDebt: number | null
    shortTermDebt: number | null
    totalCurrentLiabilities: number | null
    totalLiabilities: number | null
    // Equity
    commonStockSharesOutstanding: number | null
    totalShareholderEquity: number | null
  }>
}

export interface TwelveDataCandle {
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Raw API response types (for internal mapping)
interface RawQuoteResponse {
  symbol?: string
  name?: string
  exchange?: string
  currency?: string
  open?: string
  high?: string
  low?: string
  close?: string
  volume?: string
  previous_close?: string
  change?: string
  percent_change?: string
  fifty_two_week?: {
    high?: string
    low?: string
  }
  timestamp?: number
  status?: string
  code?: number
  message?: string
}

interface RawBalanceSheetItem {
  fiscal_date: string
  cash_and_cash_equivalents?: number | string
  total_current_assets?: number | string
  total_assets?: number | string
  total_debt?: number | string
  long_term_debt?: number | string
  short_term_debt?: number | string
  total_current_liabilities?: number | string
  total_liabilities?: number | string
  common_stock_shares_outstanding?: number | string
  total_shareholder_equity?: number | string
}

interface RawTimeSeriesItem {
  datetime: string
  open: string
  high: string
  low: string
  close: string
  volume: string
}

// Normalized quote for internal use
export interface NormalizedTwelveDataQuote {
  symbol: string
  name: string
  exchange: string
  currency: string
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
  updated: Date
}

// ============ Helpers ============

function getApiKey(): string | null {
  return process.env.TWELVE_DATA_API_KEY || null
}

/**
 * Check if Twelve Data is configured
 */
export function isTwelveDataConfigured(): boolean {
  return !!getApiKey()
}

function parseNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === "") return null
  const num = typeof val === "number" ? val : parseFloat(val)
  return isNaN(num) ? null : num
}

// ============ Quote Endpoints ============

/**
 * Get real-time quote for a single stock
 * Works for all supported exchanges
 */
export async function getQuote(symbol: string): Promise<NormalizedTwelveDataQuote | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("TWELVE_DATA_API_KEY not set, skipping Twelve Data quote")
    return null
  }

  try {
    const url = `${TWELVE_DATA_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    })

    if (!response.ok) {
      throw new Error(`Twelve Data API error: ${response.status}`)
    }

    const data = await response.json()

    // Check for error response
    if (data.status === "error" || data.code) {
      console.warn(`Twelve Data: Error for ${symbol}: ${data.message || data.code}`)
      return null
    }

    const quote: TwelveDataQuote = data

    return {
      symbol: quote.symbol,
      name: quote.name,
      exchange: quote.exchange,
      currency: quote.currency,
      price: parseFloat(quote.close) || 0,
      change: parseFloat(quote.change) || 0,
      changePercent: parseFloat(quote.percentChange) || 0,
      volume: parseFloat(quote.volume) || 0,
      open: parseFloat(quote.open) || 0,
      high: parseFloat(quote.high) || 0,
      low: parseFloat(quote.low) || 0,
      previousClose: parseFloat(quote.previousClose) || 0,
      week52High: parseNumber(quote.fiftyTwoWeek?.high),
      week52Low: parseNumber(quote.fiftyTwoWeek?.low),
      updated: new Date(quote.timestamp * 1000)
    }
  } catch (error) {
    console.error(`Error fetching Twelve Data quote for ${symbol}:`, error)
    return null
  }
}

/**
 * Get quotes for multiple stocks in a single request
 * Twelve Data supports up to 120 symbols per batch
 */
export async function getQuotesBatch(
  symbols: string[]
): Promise<Map<string, NormalizedTwelveDataQuote>> {
  const apiKey = getApiKey()
  const results = new Map<string, NormalizedTwelveDataQuote>()

  if (!apiKey) {
    console.warn("TWELVE_DATA_API_KEY not set, skipping Twelve Data batch quotes")
    return results
  }

  if (symbols.length === 0) return results

  try {
    // Twelve Data supports comma-separated symbols (max 120)
    const chunks = chunkArray(symbols, 120)

    for (const chunk of chunks) {
      const symbolList = chunk.join(",")
      const url = `${TWELVE_DATA_BASE_URL}/quote?symbol=${encodeURIComponent(symbolList)}&apikey=${apiKey}`

      const response = await fetch(url, {
        headers: { Accept: "application/json" }
      })

      if (!response.ok) {
        throw new Error(`Twelve Data API error: ${response.status}`)
      }

      const data = await response.json()

      // Single symbol returns object, multiple returns object with symbol keys
      if (chunk.length === 1) {
        const quote = normalizeQuote(data)
        if (quote) results.set(quote.symbol, quote)
      } else {
        // Multiple symbols: response is { "SYMBOL1": {...}, "SYMBOL2": {...} }
        for (const [sym, quoteData] of Object.entries(data)) {
          const quote = normalizeQuote(quoteData as TwelveDataQuote)
          if (quote) results.set(sym, quote)
        }
      }

      // Small delay between chunks to respect rate limits
      if (chunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  } catch (error) {
    console.error("Error fetching Twelve Data batch quotes:", error)
    return results
  }
}

function normalizeQuote(data: RawQuoteResponse): NormalizedTwelveDataQuote | null {
  if (!data || data.status === "error" || data.code) {
    return null
  }

  return {
    symbol: data.symbol || "",
    name: data.name || "",
    exchange: data.exchange || "",
    currency: data.currency || "USD",
    price: parseFloat(data.close || "0") || 0,
    change: parseFloat(data.change || "0") || 0,
    changePercent: parseFloat(data.percent_change || "0") || 0,
    volume: parseFloat(data.volume || "0") || 0,
    open: parseFloat(data.open || "0") || 0,
    high: parseFloat(data.high || "0") || 0,
    low: parseFloat(data.low || "0") || 0,
    previousClose: parseFloat(data.previous_close || "0") || 0,
    week52High: parseNumber(data.fifty_two_week?.high),
    week52Low: parseNumber(data.fifty_two_week?.low),
    updated: data.timestamp ? new Date(data.timestamp * 1000) : new Date()
  }
}

// ============ Fundamental Data ============

/**
 * Get company statistics (market cap, shares outstanding)
 * Note: Costs 10 credits per symbol on Pro plan
 */
export async function getStatistics(symbol: string): Promise<TwelveDataStatistics | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("TWELVE_DATA_API_KEY not set, skipping Twelve Data statistics")
    return null
  }

  try {
    const url = `${TWELVE_DATA_BASE_URL}/statistics?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    })

    if (!response.ok) {
      throw new Error(`Twelve Data API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.status === "error" || data.code) {
      console.warn(`Twelve Data statistics error for ${symbol}: ${data.message || data.code}`)
      return null
    }

    return {
      symbol: data.symbol,
      name: data.name,
      exchange: data.exchange,
      marketCapitalization: data.statistics?.valuations_metrics?.market_capitalization || null,
      sharesOutstanding: data.statistics?.stock_statistics?.shares_outstanding || null,
      floatShares: data.statistics?.stock_statistics?.float_shares || null,
      statistics: data.statistics
    }
  } catch (error) {
    console.error(`Error fetching Twelve Data statistics for ${symbol}:`, error)
    return null
  }
}

/**
 * Get balance sheet data (cash, debt, diluted shares)
 * Note: Costs 100 credits per symbol on Pro plan
 * @param period - "annual" or "quarterly"
 */
export async function getBalanceSheet(
  symbol: string,
  period: "annual" | "quarterly" = "quarterly"
): Promise<TwelveDataBalanceSheet | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("TWELVE_DATA_API_KEY not set, skipping Twelve Data balance sheet")
    return null
  }

  try {
    const url = `${TWELVE_DATA_BASE_URL}/balance_sheet?symbol=${encodeURIComponent(symbol)}&period=${period}&apikey=${apiKey}`
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    })

    if (!response.ok) {
      throw new Error(`Twelve Data API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.status === "error" || data.code) {
      console.warn(`Twelve Data balance sheet error for ${symbol}: ${data.message || data.code}`)
      return null
    }

    // Transform snake_case to camelCase and extract relevant fields
    const balanceSheet = (data.balance_sheet || []).map((item: RawBalanceSheetItem) => ({
      fiscalDate: item.fiscal_date,
      cashAndCashEquivalents: parseNumber(item.cash_and_cash_equivalents),
      totalCurrentAssets: parseNumber(item.total_current_assets),
      totalAssets: parseNumber(item.total_assets),
      totalDebt: parseNumber(item.total_debt),
      longTermDebt: parseNumber(item.long_term_debt),
      shortTermDebt: parseNumber(item.short_term_debt),
      totalCurrentLiabilities: parseNumber(item.total_current_liabilities),
      totalLiabilities: parseNumber(item.total_liabilities),
      commonStockSharesOutstanding: parseNumber(item.common_stock_shares_outstanding),
      totalShareholderEquity: parseNumber(item.total_shareholder_equity)
    }))

    return {
      symbol: data.symbol,
      balanceSheet
    }
  } catch (error) {
    console.error(`Error fetching Twelve Data balance sheet for ${symbol}:`, error)
    return null
  }
}

// ============ Historical Data ============

/**
 * Get historical time series data
 * @param symbol - Stock symbol
 * @param interval - 1day, 1week, 1month
 * @param outputSize - Number of data points (default 252 = ~1 year)
 */
export async function getTimeSeries(
  symbol: string,
  interval: "1day" | "1week" | "1month" = "1day",
  outputSize: number = 252
): Promise<TwelveDataCandle[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("TWELVE_DATA_API_KEY not set, skipping Twelve Data time series")
    return []
  }

  try {
    const url = `${TWELVE_DATA_BASE_URL}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputSize}&apikey=${apiKey}`
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    })

    if (!response.ok) {
      throw new Error(`Twelve Data API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.status === "error" || data.code || !data.values) {
      console.warn(`Twelve Data time series error for ${symbol}: ${data.message || "No data"}`)
      return []
    }

    return data.values.map((item: RawTimeSeriesItem) => ({
      date: new Date(item.datetime),
      open: parseFloat(item.open) || 0,
      high: parseFloat(item.high) || 0,
      low: parseFloat(item.low) || 0,
      close: parseFloat(item.close) || 0,
      volume: parseFloat(item.volume) || 0
    }))
  } catch (error) {
    console.error(`Error fetching Twelve Data time series for ${symbol}:`, error)
    return []
  }
}

/**
 * Get 52-week high and 200-day average for a symbol
 */
export async function getTechnicals(
  symbol: string
): Promise<{ week52High: number; avg200d: number } | null> {
  const candles = await getTimeSeries(symbol, "1day", 252)

  if (candles.length === 0) return null

  // 52-week high
  const week52High = Math.max(...candles.map(c => c.high))

  // 200-day average (or all available if less than 200 days)
  const recentCandles = candles.slice(0, 200) // Time series returns newest first
  const avg200d =
    recentCandles.reduce((sum, c) => sum + c.close, 0) / recentCandles.length

  return { week52High, avg200d }
}

// ============ Utilities ============

/**
 * Map ticker to Twelve Data format
 * Twelve Data uses exchange suffixes like Yahoo Finance
 */
export function toTwelveDataSymbol(ticker: string): string {
  // Twelve Data typically uses the same format as Yahoo Finance
  // e.g., "3350.T" for Tokyo, "1723.HK" for Hong Kong
  return ticker.toUpperCase()
}

/**
 * Get the exchange for a ticker based on its suffix
 */
export function getExchangeFromTicker(ticker: string): string {
  const suffix = ticker.split(".")[1]?.toUpperCase()

  const exchangeMap: Record<string, string> = {
    T: "TSE",      // Tokyo
    HK: "HKEX",    // Hong Kong
    L: "LSE",      // London
    V: "TSXV",     // TSX Venture
    TO: "TSX",     // Toronto
    AX: "ASX",     // Australia
    SA: "B3",      // Brazil
    BK: "SET",     // Thailand
    KQ: "KOSDAQ",  // Korea
    PA: "EPA",     // Paris/Euronext
    HM: "HAM",     // Hamburg
    AQ: "AQUIS",   // Aquis (UK)
  }

  return exchangeMap[suffix] || "UNKNOWN"
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
