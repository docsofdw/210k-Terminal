/**
 * Polygon.io (Massive) Options API Integration
 *
 * Uses Polygon.io Options API for options data with Greeks.
 * Docs: https://massive.com/docs/options
 *
 * - Full Greeks (delta, gamma, theta, vega)
 * - Implied volatility
 * - No IP restrictions (works with serverless)
 * - Real-time options data
 */

import type {
  OptionContract,
  OptionsChain,
  OptionsExpirations,
  OptionType
} from "@/types/derivatives"

const POLYGON_BASE_URL = "https://api.polygon.io"

// Cache for options data (5-minute TTL)
const cache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getApiKey(): string | null {
  return process.env.POLYGON_API_KEY || null
}

function getCached<T>(key: string): T | null {
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) {
    return cached.data as T
  }
  cache.delete(key)
  return null
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}

// ============ API Response Types ============

interface PolygonContractReference {
  ticker: string
  underlying_ticker: string
  contract_type: "call" | "put"
  expiration_date: string
  strike_price: number
  shares_per_contract: number
  exercise_style: string
}

interface PolygonContractsResponse {
  status: string
  results?: PolygonContractReference[]
  next_url?: string
  request_id: string
}

interface PolygonOptionSnapshot {
  details: {
    ticker: string
    contract_type: "call" | "put"
    expiration_date: string
    strike_price: number
    shares_per_contract: number
    exercise_style: string
  }
  day?: {
    close: number
    high: number
    low: number
    open: number
    volume: number
    vwap: number
  }
  last_quote?: {
    bid: number
    bid_size: number
    ask: number
    ask_size: number
    last_updated: number
  }
  last_trade?: {
    price: number
    size: number
  }
  greeks?: {
    delta: number
    gamma: number
    theta: number
    vega: number
  }
  implied_volatility?: number
  open_interest?: number
  underlying_asset?: {
    ticker: string
    price?: number
    change_to_break_even?: number
  }
  break_even_price?: number
}

interface PolygonSnapshotResponse {
  status: string
  results?: PolygonOptionSnapshot[]
  next_url?: string
  request_id: string
  message?: string
}

interface PolygonPrevDayResponse {
  status: string
  results?: {
    c: number // close
    h: number // high
    l: number // low
    o: number // open
    v: number // volume
    vw: number // vwap
  }[]
  request_id: string
}

// ============ Helper Functions ============

async function fetchWithKey(url: string): Promise<Response> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error("POLYGON_API_KEY not set")
  }

  const separator = url.includes("?") ? "&" : "?"
  return fetch(`${url}${separator}apiKey=${apiKey}`, {
    headers: { Accept: "application/json" }
  })
}

async function getUnderlyingPrice(symbol: string): Promise<number | null> {
  try {
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/prev`
    const response = await fetchWithKey(url)

    if (!response.ok) {
      console.error(`Polygon Quotes API error: ${response.status}`)
      return null
    }

    const data: PolygonPrevDayResponse = await response.json()

    if (data.status !== "OK" || !data.results?.[0]) {
      return null
    }

    return data.results[0].c // close price
  } catch (error) {
    console.error(`Error fetching Polygon quote for ${symbol}:`, error)
    return null
  }
}

// ============ Options Expirations ============

export async function getOptionsExpirations(
  symbol: string
): Promise<OptionsExpirations | null> {
  const cacheKey = `polygon-expirations:${symbol}`
  const cached = getCached<OptionsExpirations>(cacheKey)
  if (cached) return cached

  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("POLYGON_API_KEY not set")
    return null
  }

  try {
    // Fetch contracts to get unique expirations
    const url = `${POLYGON_BASE_URL}/v3/reference/options/contracts?underlying_ticker=${symbol}&expired=false&limit=1000`
    const response = await fetchWithKey(url)

    if (!response.ok) {
      console.error(`Polygon Options API error: ${response.status}`)
      return null
    }

    const data: PolygonContractsResponse = await response.json()

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.warn(`Polygon: No contracts for ${symbol}`)
      return null
    }

    // Extract unique expiration dates
    const expirations = [...new Set(data.results.map(c => c.expiration_date))].sort()

    if (expirations.length === 0) {
      console.warn(`Polygon: No expirations for ${symbol}`)
      return null
    }

    const result: OptionsExpirations = {
      symbol: symbol.toUpperCase(),
      expirations,
      updated: new Date()
    }

    setCache(cacheKey, result)
    return result
  } catch (error) {
    console.error(`Error fetching Polygon options expirations for ${symbol}:`, error)
    return null
  }
}

// ============ Options Chain ============

export async function getOptionsChain(
  symbol: string,
  expiration: string
): Promise<OptionsChain | null> {
  const cacheKey = `polygon-chain:${symbol}:${expiration}`
  const cached = getCached<OptionsChain>(cacheKey)
  if (cached) return cached

  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("POLYGON_API_KEY not set")
    return null
  }

  try {
    // Fetch snapshot and underlying price in parallel
    const [snapshotResponse, underlyingPrice] = await Promise.all([
      fetchWithKey(
        `${POLYGON_BASE_URL}/v3/snapshot/options/${symbol}?expiration_date=${expiration}&limit=250`
      ),
      getUnderlyingPrice(symbol)
    ])

    if (!snapshotResponse.ok) {
      const errorText = await snapshotResponse.text()
      console.error(`Polygon Options Snapshot API error: ${snapshotResponse.status}`, errorText)
      return null
    }

    const data: PolygonSnapshotResponse = await snapshotResponse.json()

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.warn(`Polygon: No snapshot for ${symbol} ${expiration}`, data.message)
      return null
    }

    const calls: OptionContract[] = []
    const puts: OptionContract[] = []

    for (const opt of data.results) {
      const type: OptionType = opt.details.contract_type === "put" ? "put" : "call"

      // Get bid/ask from last_quote, fallback to day data
      const bid = opt.last_quote?.bid ?? null
      const ask = opt.last_quote?.ask ?? null
      const last = opt.last_trade?.price ?? opt.day?.close ?? null
      const mid = bid !== null && ask !== null ? (bid + ask) / 2 : last

      const contract: OptionContract = {
        symbol: opt.details.ticker,
        underlying: symbol.toUpperCase(),
        expiration,
        strike: opt.details.strike_price,
        type,
        bid,
        ask,
        last,
        mid,
        volume: opt.day?.volume ?? 0,
        openInterest: opt.open_interest ?? 0,
        iv: opt.implied_volatility ?? null,
        delta: opt.greeks?.delta ?? null,
        gamma: opt.greeks?.gamma ?? null,
        theta: opt.greeks?.theta ?? null,
        vega: opt.greeks?.vega ?? null,
        updated: opt.last_quote?.last_updated
          ? new Date(opt.last_quote.last_updated / 1000000) // nanoseconds to ms
          : null
      }

      if (type === "call") {
        calls.push(contract)
      } else {
        puts.push(contract)
      }
    }

    // Sort by strike
    calls.sort((a, b) => a.strike - b.strike)
    puts.sort((a, b) => a.strike - b.strike)

    // Calculate days to expiry
    const expirationDate = new Date(expiration)
    const now = new Date()
    const daysToExpiry = Math.max(
      0,
      Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    )

    const result: OptionsChain = {
      symbol: symbol.toUpperCase(),
      underlyingPrice: underlyingPrice ?? 0,
      expiration,
      expirationDate,
      daysToExpiry,
      calls,
      puts,
      updated: new Date()
    }

    setCache(cacheKey, result)
    return result
  } catch (error) {
    console.error(`Error fetching Polygon options chain for ${symbol} ${expiration}:`, error)
    return null
  }
}

export function clearOptionsCache(): void {
  cache.clear()
}
