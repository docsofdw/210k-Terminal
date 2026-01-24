import yahooFinance from "yahoo-finance2"

export interface StockQuote {
  symbol: string
  price: number
  open: number | null
  high: number | null
  low: number | null
  previousClose: number | null
  volume: number | null
  marketCap: number | null
  currency: string
  exchange: string
  timestamp: Date
}

export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const result = await yahooFinance.quote(symbol)

    // Type guard - yahoo-finance2 returns Quote type
    const quote = result as {
      symbol?: string
      regularMarketPrice?: number
      regularMarketOpen?: number
      regularMarketDayHigh?: number
      regularMarketDayLow?: number
      regularMarketPreviousClose?: number
      regularMarketVolume?: number
      marketCap?: number
      currency?: string
      exchange?: string
    }

    if (!quote || typeof quote.regularMarketPrice !== "number") {
      console.error(`No quote data for ${symbol}`)
      return null
    }

    return {
      symbol: quote.symbol ?? symbol,
      price: quote.regularMarketPrice,
      open: quote.regularMarketOpen ?? null,
      high: quote.regularMarketDayHigh ?? null,
      low: quote.regularMarketDayLow ?? null,
      previousClose: quote.regularMarketPreviousClose ?? null,
      volume: quote.regularMarketVolume ?? null,
      marketCap: quote.marketCap ?? null,
      currency: quote.currency ?? "USD",
      exchange: quote.exchange ?? "",
      timestamp: new Date()
    }
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error)
    return null
  }
}

export async function getMultipleQuotes(
  symbols: string[]
): Promise<Map<string, StockQuote>> {
  const results = new Map<string, StockQuote>()

  // Fetch in batches to avoid rate limits
  const batchSize = 5
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)

    const promises = batch.map(async symbol => {
      const quote = await getStockQuote(symbol)
      if (quote) {
        results.set(symbol, quote)
      }
    })

    await Promise.all(promises)

    // Small delay between batches
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return results
}

interface HistoricalDay {
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export async function getHistoricalPrices(
  symbol: string,
  startDate: Date,
  endDate: Date = new Date()
): Promise<HistoricalDay[]> {
  try {
    const result = await yahooFinance.historical(symbol, {
      period1: startDate,
      period2: endDate,
      interval: "1d"
    })

    // Type assertion for yahoo-finance2 historical result
    const data = result as Array<{
      date: Date
      open: number
      high: number
      low: number
      close: number
      volume: number
    }>

    return data.map(day => ({
      date: day.date,
      open: day.open,
      high: day.high,
      low: day.low,
      close: day.close,
      volume: day.volume
    }))
  } catch (error) {
    console.error(`Error fetching historical prices for ${symbol}:`, error)
    return []
  }
}
