/**
 * MarketData.app Options API Integration
 *
 * Uses MarketData.app Pro for options data with Greeks.
 * Docs: https://www.marketdata.app/docs/api/options/
 */

import type {
  OptionContract,
  OptionsChain,
  OptionsExpirations,
  OptionType
} from "@/types/derivatives"

const MARKETDATA_BASE_URL = "https://api.marketdata.app/v1"

// Cache for options data (5-minute TTL)
const cache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getApiKey(): string | null {
  return process.env.MARKETDATA_API_KEY || null
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

interface MarketDataExpirationsResponse {
  s: "ok" | "error"
  expirations?: string[]
  errmsg?: string
}

interface MarketDataOptionChainResponse {
  s: "ok" | "no_data" | "error"
  optionSymbol?: string[]
  underlying?: string[]
  expiration?: number[]
  side?: ("call" | "put")[]
  strike?: number[]
  updated?: number[]
  bid?: number[]
  bidSize?: number[]
  mid?: number[]
  ask?: number[]
  askSize?: number[]
  last?: number[]
  openInterest?: number[]
  volume?: number[]
  underlyingPrice?: number[]
  iv?: number[]
  delta?: number[]
  gamma?: number[]
  theta?: number[]
  vega?: number[]
  errmsg?: string
}

// ============ Options Expirations ============

export async function getOptionsExpirations(
  symbol: string
): Promise<OptionsExpirations | null> {
  const cacheKey = `md-expirations:${symbol}`
  const cached = getCached<OptionsExpirations>(cacheKey)
  if (cached) return cached

  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("MARKETDATA_API_KEY not set")
    return null
  }

  try {
    const url = `${MARKETDATA_BASE_URL}/options/expirations/${symbol}/?token=${apiKey}`
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    })

    if (!response.ok) {
      console.error(`MarketData Options API error: ${response.status}`)
      return null
    }

    const data: MarketDataExpirationsResponse = await response.json()

    if (data.s !== "ok" || !data.expirations || data.expirations.length === 0) {
      console.warn(`MarketData: No expirations for ${symbol}: ${data.errmsg || "No data"}`)
      return null
    }

    const result: OptionsExpirations = {
      symbol: symbol.toUpperCase(),
      expirations: data.expirations.sort(),
      updated: new Date()
    }

    setCache(cacheKey, result)
    return result
  } catch (error) {
    console.error(`Error fetching MarketData options expirations for ${symbol}:`, error)
    return null
  }
}

// ============ Options Chain ============

export async function getOptionsChain(
  symbol: string,
  expiration: string
): Promise<OptionsChain | null> {
  const cacheKey = `md-chain:${symbol}:${expiration}`
  const cached = getCached<OptionsChain>(cacheKey)
  if (cached) return cached

  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("MARKETDATA_API_KEY not set")
    return null
  }

  try {
    const url = `${MARKETDATA_BASE_URL}/options/chain/${symbol}/?token=${apiKey}&expiration=${expiration}`
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    })

    if (!response.ok) {
      console.error(`MarketData Options API error: ${response.status}`)
      return null
    }

    const data: MarketDataOptionChainResponse = await response.json()

    if (data.s !== "ok" || !data.optionSymbol || data.optionSymbol.length === 0) {
      console.warn(`MarketData: No chain for ${symbol} ${expiration}: ${data.errmsg || "No data"}`)
      return null
    }

    const calls: OptionContract[] = []
    const puts: OptionContract[] = []

    for (let i = 0; i < data.optionSymbol.length; i++) {
      const type: OptionType = data.side?.[i] === "put" ? "put" : "call"

      const contract: OptionContract = {
        symbol: data.optionSymbol[i],
        underlying: symbol.toUpperCase(),
        expiration,
        strike: data.strike?.[i] ?? 0,
        type,
        bid: data.bid?.[i] ?? null,
        ask: data.ask?.[i] ?? null,
        last: data.last?.[i] ?? null,
        mid: data.mid?.[i] ?? null,
        volume: data.volume?.[i] ?? 0,
        openInterest: data.openInterest?.[i] ?? 0,
        iv: data.iv?.[i] ?? null,
        delta: data.delta?.[i] ?? null,
        gamma: data.gamma?.[i] ?? null,
        theta: data.theta?.[i] ?? null,
        vega: data.vega?.[i] ?? null,
        updated: data.updated?.[i] ? new Date(data.updated[i] * 1000) : null
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

    const underlyingPrice = data.underlyingPrice?.[0] ?? 0

    const result: OptionsChain = {
      symbol: symbol.toUpperCase(),
      underlyingPrice,
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
    console.error(`Error fetching MarketData options chain for ${symbol} ${expiration}:`, error)
    return null
  }
}

export function clearOptionsCache(): void {
  cache.clear()
}
