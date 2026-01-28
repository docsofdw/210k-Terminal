/**
 * Finnhub API Integration
 *
 * Free tier: 60 API calls/minute, ~15 minute delayed quotes
 * Best for: US stocks, real-time news, earnings data
 *
 * For international stocks, Yahoo Finance is recommended.
 *
 * Sign up for free API key: https://finnhub.io/
 */

export interface FinnhubQuote {
  symbol: string
  currentPrice: number
  change: number
  percentChange: number
  highPrice: number
  lowPrice: number
  openPrice: number
  previousClose: number
  timestamp: Date
}

export interface FinnhubCandle {
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1"

function getApiKey(): string | null {
  return process.env.FINNHUB_API_KEY || null
}

/**
 * Get real-time quote for a US stock
 * Note: Free tier has ~15 minute delay
 */
export async function getFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("FINNHUB_API_KEY not set, skipping Finnhub quote")
    return null
  }

  try {
    const url = `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${apiKey}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`)
    }

    const data = await response.json()

    // Finnhub returns 0 for all values if symbol not found
    if (data.c === 0 && data.h === 0 && data.l === 0) {
      console.warn(`Finnhub: No data for symbol ${symbol}`)
      return null
    }

    return {
      symbol,
      currentPrice: data.c,        // Current price
      change: data.d,              // Change
      percentChange: data.dp,       // Percent change
      highPrice: data.h,           // High price of the day
      lowPrice: data.l,            // Low price of the day
      openPrice: data.o,           // Open price
      previousClose: data.pc,      // Previous close price
      timestamp: new Date(data.t * 1000) // Unix timestamp
    }
  } catch (error) {
    console.error(`Error fetching Finnhub quote for ${symbol}:`, error)
    return null
  }
}

/**
 * Get historical candles (OHLCV data)
 * Resolution: 1, 5, 15, 30, 60, D, W, M
 */
export async function getFinnhubCandles(
  symbol: string,
  resolution: "1" | "5" | "15" | "30" | "60" | "D" | "W" | "M",
  from: Date,
  to: Date
): Promise<FinnhubCandle[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("FINNHUB_API_KEY not set, skipping Finnhub candles")
    return []
  }

  try {
    const fromTimestamp = Math.floor(from.getTime() / 1000)
    const toTimestamp = Math.floor(to.getTime() / 1000)

    const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${fromTimestamp}&to=${toTimestamp}&token=${apiKey}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`)
    }

    const data = await response.json()

    // Check for no data response
    if (data.s === "no_data" || !data.c || data.c.length === 0) {
      return []
    }

    // Convert to array of candles
    const candles: FinnhubCandle[] = []
    for (let i = 0; i < data.c.length; i++) {
      candles.push({
        date: new Date(data.t[i] * 1000),
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v[i]
      })
    }

    return candles
  } catch (error) {
    console.error(`Error fetching Finnhub candles for ${symbol}:`, error)
    return []
  }
}

/**
 * Get multiple quotes at once (to reduce API calls)
 * Note: Finnhub doesn't have a batch quote endpoint, so we fetch sequentially
 */
export async function getMultipleFinnhubQuotes(
  symbols: string[]
): Promise<Map<string, FinnhubQuote>> {
  const results = new Map<string, FinnhubQuote>()

  // Rate limit: 60 calls/minute = 1 per second to be safe
  for (const symbol of symbols) {
    const quote = await getFinnhubQuote(symbol)
    if (quote) {
      results.set(symbol, quote)
    }
    // Small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}

/**
 * Check if Finnhub is configured and available
 */
export function isFinnhubConfigured(): boolean {
  return !!getApiKey()
}

/**
 * Map common ticker formats to Finnhub format
 * Finnhub uses standard US ticker symbols
 */
export function toFinnhubSymbol(ticker: string): string {
  // Finnhub uses standard US symbols
  // Remove any exchange suffixes
  return ticker.split(".")[0].toUpperCase()
}
