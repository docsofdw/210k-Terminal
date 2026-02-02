/**
 * Tradier Options API Integration
 *
 * Uses Tradier Market Data API for options data with Greeks.
 * Docs: https://docs.tradier.com/reference/brokerage-api-markets-get-options-chains
 *
 * Pricing: $10/month for market data only (no brokerage account needed)
 * - No IP restrictions (works with serverless)
 * - Full Greeks included
 * - Real-time options data
 */

import type {
  OptionContract,
  OptionsChain,
  OptionsExpirations,
  OptionType
} from "@/types/derivatives"

const TRADIER_BASE_URL = "https://api.tradier.com/v1"

// Cache for options data (5-minute TTL)
const cache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getApiKey(): string | null {
  return process.env.TRADIER_API_KEY || null
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

interface TradierExpirationsResponse {
  expirations: {
    date: string[] | string | null
  } | null
}

interface TradierOptionContract {
  symbol: string
  description: string
  strike: number
  underlying: string
  option_type: "call" | "put"
  last: number | null
  bid: number | null
  ask: number | null
  volume: number
  open_interest: number
  greeks?: {
    delta: number | null
    gamma: number | null
    theta: number | null
    vega: number | null
    rho: number | null
    bid_iv: number | null
    mid_iv: number | null
    ask_iv: number | null
    updated_at: string | null
  }
}

interface TradierChainResponse {
  options: {
    option: TradierOptionContract[] | TradierOptionContract | null
  } | null
}

interface TradierQuoteResponse {
  quotes: {
    quote: {
      symbol: string
      last: number
      bid: number
      ask: number
    } | {
      symbol: string
      last: number
      bid: number
      ask: number
    }[]
  } | null
}

// ============ Helper Functions ============

async function fetchWithAuth(url: string): Promise<Response> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error("TRADIER_API_KEY not set")
  }

  return fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`
    }
  })
}

async function getUnderlyingPrice(symbol: string): Promise<number | null> {
  try {
    const url = `${TRADIER_BASE_URL}/markets/quotes?symbols=${symbol}`
    const response = await fetchWithAuth(url)

    if (!response.ok) {
      console.error(`Tradier Quotes API error: ${response.status}`)
      return null
    }

    const data: TradierQuoteResponse = await response.json()

    if (!data.quotes?.quote) return null

    const quote = Array.isArray(data.quotes.quote)
      ? data.quotes.quote[0]
      : data.quotes.quote

    return quote?.last ?? null
  } catch (error) {
    console.error(`Error fetching Tradier quote for ${symbol}:`, error)
    return null
  }
}

// ============ Options Expirations ============

export async function getOptionsExpirations(
  symbol: string
): Promise<OptionsExpirations | null> {
  const cacheKey = `tradier-expirations:${symbol}`
  const cached = getCached<OptionsExpirations>(cacheKey)
  if (cached) return cached

  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("TRADIER_API_KEY not set")
    return null
  }

  try {
    const url = `${TRADIER_BASE_URL}/markets/options/expirations?symbol=${symbol}&includeAllRoots=true`
    const response = await fetchWithAuth(url)

    if (!response.ok) {
      console.error(`Tradier Options API error: ${response.status}`)
      return null
    }

    const data: TradierExpirationsResponse = await response.json()

    if (!data.expirations?.date) {
      console.warn(`Tradier: No expirations for ${symbol}`)
      return null
    }

    // Handle both array and single string responses
    const dates = Array.isArray(data.expirations.date)
      ? data.expirations.date
      : [data.expirations.date]

    if (dates.length === 0) {
      console.warn(`Tradier: No expirations for ${symbol}`)
      return null
    }

    const result: OptionsExpirations = {
      symbol: symbol.toUpperCase(),
      expirations: dates.sort(),
      updated: new Date()
    }

    setCache(cacheKey, result)
    return result
  } catch (error) {
    console.error(`Error fetching Tradier options expirations for ${symbol}:`, error)
    return null
  }
}

// ============ Options Chain ============

export async function getOptionsChain(
  symbol: string,
  expiration: string
): Promise<OptionsChain | null> {
  const cacheKey = `tradier-chain:${symbol}:${expiration}`
  const cached = getCached<OptionsChain>(cacheKey)
  if (cached) return cached

  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("TRADIER_API_KEY not set")
    return null
  }

  try {
    // Fetch chain and underlying price in parallel
    const [chainResponse, underlyingPrice] = await Promise.all([
      fetchWithAuth(
        `${TRADIER_BASE_URL}/markets/options/chains?symbol=${symbol}&expiration=${expiration}&greeks=true`
      ),
      getUnderlyingPrice(symbol)
    ])

    if (!chainResponse.ok) {
      console.error(`Tradier Options Chain API error: ${chainResponse.status}`)
      return null
    }

    const data: TradierChainResponse = await chainResponse.json()

    if (!data.options?.option) {
      console.warn(`Tradier: No chain for ${symbol} ${expiration}`)
      return null
    }

    // Handle both array and single option responses
    const options = Array.isArray(data.options.option)
      ? data.options.option
      : [data.options.option]

    if (options.length === 0) {
      console.warn(`Tradier: No chain for ${symbol} ${expiration}`)
      return null
    }

    const calls: OptionContract[] = []
    const puts: OptionContract[] = []

    for (const opt of options) {
      const type: OptionType = opt.option_type === "put" ? "put" : "call"

      // Calculate mid price
      const bid = opt.bid ?? null
      const ask = opt.ask ?? null
      const mid = bid !== null && ask !== null ? (bid + ask) / 2 : null

      // Get IV (prefer mid_iv, fallback to ask_iv or bid_iv)
      const iv = opt.greeks?.mid_iv ?? opt.greeks?.ask_iv ?? opt.greeks?.bid_iv ?? null

      const contract: OptionContract = {
        symbol: opt.symbol,
        underlying: symbol.toUpperCase(),
        expiration,
        strike: opt.strike,
        type,
        bid,
        ask,
        last: opt.last,
        mid,
        volume: opt.volume ?? 0,
        openInterest: opt.open_interest ?? 0,
        iv,
        delta: opt.greeks?.delta ?? null,
        gamma: opt.greeks?.gamma ?? null,
        theta: opt.greeks?.theta ?? null,
        vega: opt.greeks?.vega ?? null,
        updated: opt.greeks?.updated_at ? new Date(opt.greeks.updated_at) : null
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
    console.error(`Error fetching Tradier options chain for ${symbol} ${expiration}:`, error)
    return null
  }
}

export function clearOptionsCache(): void {
  cache.clear()
}
