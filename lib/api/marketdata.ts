/**
 * MarketData.app API Integration
 *
 * Pricing: ~$30/month (Trader plan)
 * Rate limit: 100 requests/minute
 * Coverage: US stocks (NYSE, NASDAQ, AMEX)
 *
 * Used for: Real-time quotes, historical data for US treasury companies
 *
 * Sign up: https://www.marketdata.app/
 * Docs: https://www.marketdata.app/docs/api/
 */

const MARKETDATA_BASE_URL = "https://api.marketdata.app/v1"

// ============ Types ============

export interface MarketDataQuote {
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
  updated: Date
}

export interface MarketDataCandle {
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface MarketDataQuoteResponse {
  s: "ok" | "error"
  symbol: string[]
  name: string[]
  last: number[]
  change: number[]
  changepct: number[]
  volume: number[]
  open: number[]
  high: number[]
  low: number[]
  prevClose: number[]
  "52weekHigh"?: number[]
  "52weekLow"?: number[]
  marketCap?: number[]
  sharesOutstanding?: number[]
  updated: number[]
}

interface MarketDataCandleResponse {
  s: "ok" | "no_data" | "error"
  o?: number[]
  h?: number[]
  l?: number[]
  c?: number[]
  v?: number[]
  t?: number[]
}

// ============ Helpers ============

function getApiKey(): string | null {
  return process.env.MARKETDATA_API_KEY || null
}

/**
 * Check if MarketData.app is configured
 */
export function isMarketDataConfigured(): boolean {
  return !!getApiKey()
}

// ============ Quote Endpoints ============

/**
 * Get real-time quote for a single US stock
 */
export async function getQuote(symbol: string): Promise<MarketDataQuote | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("MARKETDATA_API_KEY not set, skipping MarketData quote")
    return null
  }

  try {
    const url = `${MARKETDATA_BASE_URL}/stocks/quotes/${symbol}/?token=${apiKey}`
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    })

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`MarketData: Symbol ${symbol} not found`)
        return null
      }
      throw new Error(`MarketData API error: ${response.status}`)
    }

    const data: MarketDataQuoteResponse = await response.json()

    if (data.s !== "ok" || !data.symbol || data.symbol.length === 0) {
      console.warn(`MarketData: No data for symbol ${symbol}`)
      return null
    }

    return {
      symbol: data.symbol[0],
      name: data.name?.[0] || null,
      price: data.last?.[0] || 0,
      change: data.change?.[0] || 0,
      changePercent: data.changepct?.[0] || 0,
      volume: data.volume?.[0] || 0,
      open: data.open?.[0] || data.last?.[0] || 0,
      high: data.high?.[0] || data.last?.[0] || 0,
      low: data.low?.[0] || data.last?.[0] || 0,
      previousClose: data.prevClose?.[0] || 0,
      week52High: data["52weekHigh"]?.[0] || null,
      week52Low: data["52weekLow"]?.[0] || null,
      marketCap: data.marketCap?.[0] || null,
      sharesOutstanding: data.sharesOutstanding?.[0] || null,
      updated: new Date((data.updated?.[0] || Date.now() / 1000) * 1000)
    }
  } catch (error) {
    console.error(`Error fetching MarketData quote for ${symbol}:`, error)
    return null
  }
}

/**
 * Get quotes for multiple US stocks in a single request
 * MarketData.app supports comma-separated symbols
 */
export async function getQuotesBatch(
  symbols: string[]
): Promise<Map<string, MarketDataQuote>> {
  const apiKey = getApiKey()
  const results = new Map<string, MarketDataQuote>()

  if (!apiKey) {
    console.warn("MARKETDATA_API_KEY not set, skipping MarketData batch quotes")
    return results
  }

  if (symbols.length === 0) return results

  try {
    // MarketData supports batch quotes with comma-separated symbols
    const symbolList = symbols.join(",")
    const url = `${MARKETDATA_BASE_URL}/stocks/quotes/${symbolList}/?token=${apiKey}`

    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    })

    if (!response.ok) {
      throw new Error(`MarketData API error: ${response.status}`)
    }

    const data: MarketDataQuoteResponse = await response.json()

    if (data.s !== "ok" || !data.symbol) {
      console.warn("MarketData: Batch request returned no data")
      return results
    }

    // Parse batch response into individual quotes
    for (let i = 0; i < data.symbol.length; i++) {
      const quote: MarketDataQuote = {
        symbol: data.symbol[i],
        name: data.name?.[i] || null,
        price: data.last?.[i] || 0,
        change: data.change?.[i] || 0,
        changePercent: data.changepct?.[i] || 0,
        volume: data.volume?.[i] || 0,
        open: data.open?.[i] || data.last?.[i] || 0,
        high: data.high?.[i] || data.last?.[i] || 0,
        low: data.low?.[i] || data.last?.[i] || 0,
        previousClose: data.prevClose?.[i] || 0,
        week52High: data["52weekHigh"]?.[i] || null,
        week52Low: data["52weekLow"]?.[i] || null,
        marketCap: data.marketCap?.[i] || null,
        sharesOutstanding: data.sharesOutstanding?.[i] || null,
        updated: new Date((data.updated?.[i] || Date.now() / 1000) * 1000)
      }
      results.set(data.symbol[i], quote)
    }

    return results
  } catch (error) {
    console.error("Error fetching MarketData batch quotes:", error)
    return results
  }
}

// ============ Historical Data ============

/**
 * Get historical candles (OHLCV data)
 * @param symbol - Stock symbol
 * @param resolution - D (daily), W (weekly), M (monthly)
 * @param from - Start date
 * @param to - End date
 */
export async function getCandles(
  symbol: string,
  resolution: "D" | "W" | "M" = "D",
  from?: Date,
  to?: Date
): Promise<MarketDataCandle[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("MARKETDATA_API_KEY not set, skipping MarketData candles")
    return []
  }

  try {
    const params = new URLSearchParams({ token: apiKey })

    if (from) {
      params.append("from", from.toISOString().split("T")[0])
    }
    if (to) {
      params.append("to", to.toISOString().split("T")[0])
    }

    const url = `${MARKETDATA_BASE_URL}/stocks/candles/${resolution}/${symbol}/?${params}`
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    })

    if (!response.ok) {
      throw new Error(`MarketData API error: ${response.status}`)
    }

    const data: MarketDataCandleResponse = await response.json()

    if (data.s !== "ok" || !data.c || data.c.length === 0) {
      return []
    }

    const candles: MarketDataCandle[] = []
    for (let i = 0; i < data.c.length; i++) {
      candles.push({
        date: new Date(data.t![i] * 1000),
        open: data.o![i],
        high: data.h![i],
        low: data.l![i],
        close: data.c[i],
        volume: data.v![i]
      })
    }

    return candles
  } catch (error) {
    console.error(`Error fetching MarketData candles for ${symbol}:`, error)
    return []
  }
}

/**
 * Get 52-week high and 200-day average for a symbol
 * Uses historical candles to calculate
 */
export async function getTechnicals(
  symbol: string
): Promise<{ week52High: number; avg200d: number } | null> {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 365) // 1 year of data

  const candles = await getCandles(symbol, "D", from, to)

  if (candles.length === 0) return null

  // 52-week high
  const week52High = Math.max(...candles.map(c => c.high))

  // 200-day average (or all available if less than 200 days)
  const recentCandles = candles.slice(-200)
  const avg200d =
    recentCandles.reduce((sum, c) => sum + c.close, 0) / recentCandles.length

  return { week52High, avg200d }
}

/**
 * Map ticker to MarketData format
 * MarketData uses standard US symbols without exchange suffix
 */
export function toMarketDataSymbol(ticker: string): string {
  // Remove any exchange suffix (e.g., "MSTR.US" -> "MSTR")
  return ticker.split(".")[0].toUpperCase()
}
