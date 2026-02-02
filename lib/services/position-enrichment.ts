/**
 * Position Enrichment Service
 *
 * Enriches Clear Street positions with:
 * - Pricing and P&L from Clear Street /pnl-details endpoint
 * - Greeks from Polygon.io options chains
 */

import type {
  ClearStreetPnlDetail,
  EnrichedPosition
} from "@/types/clear-street"
import type { OptionsChain, OptionContract } from "@/types/derivatives"
import { parseOccSymbol, parseSymbol } from "@/lib/utils/occ-parser"
import { getOptionsChain } from "@/lib/api/polygon-options"

// ============ Types ============

interface PositionGroup {
  underlying: string
  expiration: string
  positions: ClearStreetPnlDetail[]
}

interface EnrichmentResult {
  positions: EnrichedPosition[]
  errors: string[]
}

// ============ Grouping Logic ============

/**
 * Group positions by underlying and expiration for efficient API calls
 */
function groupPositions(positions: ClearStreetPnlDetail[]): {
  optionGroups: PositionGroup[]
  equities: ClearStreetPnlDetail[]
} {
  const groups = new Map<string, PositionGroup>()
  const equities: ClearStreetPnlDetail[] = []

  for (const position of positions) {
    const parsed = parseSymbol(position.symbol)

    if (!parsed.isOption) {
      equities.push(position)
      continue
    }

    const key = `${parsed.underlying}:${parsed.expiration}`

    if (!groups.has(key)) {
      groups.set(key, {
        underlying: parsed.underlying,
        expiration: parsed.expiration,
        positions: []
      })
    }

    groups.get(key)!.positions.push(position)
  }

  return {
    optionGroups: Array.from(groups.values()),
    equities
  }
}

// ============ Contract Matching ============

/**
 * Find the matching contract in an options chain for a position
 */
function findMatchingContract(
  position: ClearStreetPnlDetail,
  chain: OptionsChain
): OptionContract | null {
  const parsed = parseOccSymbol(position.symbol)
  if (!parsed) return null

  const contracts = parsed.type === "call" ? chain.calls : chain.puts

  // Find contract with matching strike
  const contract = contracts.find(
    (c) => Math.abs(c.strike - parsed.strike) < 0.01
  )

  return contract || null
}

// ============ Enrichment Logic ============

/**
 * Enrich a single option position with Clear Street P&L and Polygon Greeks
 */
function enrichOptionPosition(
  position: ClearStreetPnlDetail,
  contract: OptionContract | null,
  parsed: ReturnType<typeof parseOccSymbol>
): EnrichedPosition {
  const quantity = parseFloat(position.quantity)
  const multiplier = 100

  // Greeks from Polygon (null if unavailable)
  const delta = contract?.delta ?? null
  const gamma = contract?.gamma ?? null
  const theta = contract?.theta ?? null
  const vega = contract?.vega ?? null

  // Calculate Greek exposures
  const deltaExposure = delta !== null ? quantity * delta * multiplier : 0
  const gammaExposure = gamma !== null ? quantity * gamma * multiplier : 0
  const thetaExposure = theta !== null ? quantity * theta * multiplier : 0
  const vegaExposure = vega !== null ? quantity * vega * multiplier : 0

  return {
    accountId: position.account_id,
    accountNumber: position.account_number,
    clearStreetSymbol: position.symbol,
    quantity,

    // Parsed option details
    underlying: parsed!.underlying,
    expiration: parsed!.expiration,
    strike: parsed!.strike,
    optionType: parsed!.type,

    // Pricing from Clear Street
    currentPrice: position.price,
    sodPrice: position.sod_price,

    // Greeks from Polygon
    bid: contract?.bid ?? null,
    ask: contract?.ask ?? null,
    iv: contract?.iv ?? null,
    delta,
    gamma,
    theta,
    vega,

    // P&L from Clear Street (mark-to-market)
    marketValue: position.net_market_value,
    sodMarketValue: position.sod_market_value,
    dayPnl: position.day_pnl,
    unrealizedPnl: position.unrealized_pnl,
    realizedPnl: position.realized_pnl,
    totalPnl: position.total_pnl,
    overnightPnl: position.overnight_pnl,
    totalFees: position.total_fees,

    // Trade activity
    boughtQuantity: parseFloat(position.bought_quantity) || 0,
    soldQuantity: parseFloat(position.sold_quantity) || 0,
    buys: position.buys,
    sells: position.sells,

    // Greek exposures
    deltaExposure,
    gammaExposure,
    thetaExposure,
    vegaExposure,

    // Metadata
    isOption: true,
    multiplier,
    source: "clear-street",
    enrichedAt: contract ? new Date() : null,
    error: contract ? undefined : "Could not find matching contract for Greeks"
  }
}

/**
 * Enrich an equity position (no Greeks)
 */
function enrichEquityPosition(position: ClearStreetPnlDetail): EnrichedPosition {
  const quantity = parseFloat(position.quantity)
  const multiplier = 1

  return {
    accountId: position.account_id,
    accountNumber: position.account_number,
    clearStreetSymbol: position.symbol,
    quantity,

    underlying: position.underlier || position.symbol,
    expiration: null,
    strike: null,
    optionType: null,

    // Pricing from Clear Street
    currentPrice: position.price,
    sodPrice: position.sod_price,

    // No Greeks for equities
    bid: null,
    ask: null,
    iv: null,
    delta: quantity > 0 ? 1 : -1,
    gamma: null,
    theta: null,
    vega: null,

    // P&L from Clear Street
    marketValue: position.net_market_value,
    sodMarketValue: position.sod_market_value,
    dayPnl: position.day_pnl,
    unrealizedPnl: position.unrealized_pnl,
    realizedPnl: position.realized_pnl,
    totalPnl: position.total_pnl,
    overnightPnl: position.overnight_pnl,
    totalFees: position.total_fees,

    // Trade activity
    boughtQuantity: parseFloat(position.bought_quantity) || 0,
    soldQuantity: parseFloat(position.sold_quantity) || 0,
    buys: position.buys,
    sells: position.sells,

    // Greek exposures
    deltaExposure: quantity,
    gammaExposure: 0,
    thetaExposure: 0,
    vegaExposure: 0,

    // Metadata
    isOption: false,
    multiplier,
    source: "clear-street",
    enrichedAt: null,
    error: "Equity position - no Greeks data"
  }
}

// ============ Main Enrichment Function ============

/**
 * Enrich positions with Greeks from Polygon.io
 *
 * Takes positions from Clear Street /pnl-details (which includes pricing and P&L),
 * then adds Greeks from Polygon.io options chains.
 */
export async function enrichPositionsWithGreeks(
  positions: ClearStreetPnlDetail[]
): Promise<EnrichmentResult> {
  const errors: string[] = []
  const enrichedPositions: EnrichedPosition[] = []

  if (positions.length === 0) {
    return { positions: [], errors: [] }
  }

  // Group positions
  const { optionGroups, equities } = groupPositions(positions)

  // Enrich equities (no API calls needed)
  for (const equity of equities) {
    enrichedPositions.push(enrichEquityPosition(equity))
  }

  // Fetch options chains for each group in parallel
  const chainPromises = optionGroups.map(async (group) => {
    try {
      const chain = await getOptionsChain(group.underlying, group.expiration)
      return { group, chain, error: null }
    } catch (error) {
      return {
        group,
        chain: null,
        error: `Failed to fetch Greeks for ${group.underlying} ${group.expiration}: ${error instanceof Error ? error.message : "Unknown error"}`
      }
    }
  })

  const chainResults = await Promise.all(chainPromises)

  // Process each group's positions with their chain data
  for (const { group, chain, error } of chainResults) {
    if (error) {
      errors.push(error)
    }

    for (const position of group.positions) {
      const parsed = parseOccSymbol(position.symbol)

      if (!parsed) {
        errors.push(`Failed to parse option symbol: ${position.symbol}`)
        continue
      }

      // Find matching contract if we have chain data
      const contract = chain ? findMatchingContract(position, chain) : null

      if (chain && !contract) {
        errors.push(
          `No matching contract found for ${position.symbol} (strike ${parsed.strike})`
        )
      }

      enrichedPositions.push(enrichOptionPosition(position, contract, parsed))
    }
  }

  // Sort by underlying, then by strike
  enrichedPositions.sort((a, b) => {
    if (a.underlying !== b.underlying) {
      return a.underlying.localeCompare(b.underlying)
    }
    if (a.strike !== b.strike) {
      if (a.strike === null) return 1
      if (b.strike === null) return -1
      return a.strike - b.strike
    }
    return 0
  })

  return { positions: enrichedPositions, errors }
}

/**
 * Calculate summary statistics for enriched positions
 */
export function calculatePositionsSummary(positions: EnrichedPosition[]): {
  totalPositions: number
  optionsCount: number
  equitiesCount: number
  totalMarketValue: number
  totalDayPnl: number
  totalUnrealizedPnl: number
  totalRealizedPnl: number
  totalPnl: number
  totalFees: number
  totalDelta: number
  totalGamma: number
  totalTheta: number
  totalVega: number
} {
  const optionsCount = positions.filter((p) => p.isOption).length
  const equitiesCount = positions.filter((p) => !p.isOption).length

  return {
    totalPositions: positions.length,
    optionsCount,
    equitiesCount,
    totalMarketValue: positions.reduce((sum, p) => sum + p.marketValue, 0),
    totalDayPnl: positions.reduce((sum, p) => sum + p.dayPnl, 0),
    totalUnrealizedPnl: positions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
    totalRealizedPnl: positions.reduce((sum, p) => sum + p.realizedPnl, 0),
    totalPnl: positions.reduce((sum, p) => sum + p.totalPnl, 0),
    totalFees: positions.reduce((sum, p) => sum + p.totalFees, 0),
    totalDelta: positions.reduce((sum, p) => sum + p.deltaExposure, 0),
    totalGamma: positions.reduce((sum, p) => sum + p.gammaExposure, 0),
    totalTheta: positions.reduce((sum, p) => sum + p.thetaExposure, 0),
    totalVega: positions.reduce((sum, p) => sum + p.vegaExposure, 0)
  }
}
