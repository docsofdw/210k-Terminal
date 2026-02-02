/**
 * Position Enrichment Service
 *
 * Enriches Clear Street positions with Greeks data from Polygon.io.
 * Groups positions by underlying and expiration to minimize API calls.
 */

import type {
  ClearStreetPosition,
  EnrichedPosition
} from "@/types/clear-street"
import type { OptionsChain, OptionContract } from "@/types/derivatives"
import { parseOccSymbol, parseSymbol } from "@/lib/utils/occ-parser"
import { getOptionsChain } from "@/lib/api/polygon-options"

// ============ Types ============

interface PositionGroup {
  underlying: string
  expiration: string
  positions: ClearStreetPosition[]
}

interface EnrichmentResult {
  positions: EnrichedPosition[]
  errors: string[]
}

// ============ Grouping Logic ============

/**
 * Group positions by underlying and expiration for efficient API calls
 */
function groupPositions(positions: ClearStreetPosition[]): {
  optionGroups: PositionGroup[]
  equities: ClearStreetPosition[]
} {
  const groups = new Map<string, PositionGroup>()
  const equities: ClearStreetPosition[] = []

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
  position: ClearStreetPosition,
  chain: OptionsChain
): OptionContract | null {
  const parsed = parseOccSymbol(position.symbol)
  if (!parsed) return null

  const contracts = parsed.type === "call" ? chain.calls : chain.puts

  // Find contract with matching strike
  // Allow small tolerance for floating point comparison
  const contract = contracts.find(
    (c) => Math.abs(c.strike - parsed.strike) < 0.01
  )

  return contract || null
}

// ============ Enrichment Logic ============

/**
 * Enrich a single option position with data from a matched contract
 */
function enrichOptionPosition(
  position: ClearStreetPosition,
  contract: OptionContract | null,
  parsed: ReturnType<typeof parseOccSymbol>
): EnrichedPosition {
  const quantity = parseFloat(position.quantity)
  const averageCost = position.average_cost
  const multiplier = 100 // Options have 100 share multiplier

  // Calculate current price from contract (use mid if available)
  const currentPrice = contract?.mid ?? contract?.last ?? null

  // Calculate market value and P&L
  const marketValue = currentPrice !== null ? quantity * currentPrice * multiplier : 0
  const costBasis = quantity * averageCost * multiplier
  const unrealizedPnl = currentPrice !== null ? marketValue - costBasis : 0
  const unrealizedPnlPercent =
    costBasis !== 0 ? (unrealizedPnl / Math.abs(costBasis)) * 100 : 0

  // Calculate Greek exposures (multiply by quantity and multiplier)
  const delta = contract?.delta ?? null
  const gamma = contract?.gamma ?? null
  const theta = contract?.theta ?? null
  const vega = contract?.vega ?? null

  const deltaExposure = delta !== null ? quantity * delta * multiplier : 0
  const gammaExposure = gamma !== null ? quantity * gamma * multiplier : 0
  const thetaExposure = theta !== null ? quantity * theta * multiplier : 0
  const vegaExposure = vega !== null ? quantity * vega * multiplier : 0

  return {
    accountId: position.account_id,
    accountNumber: position.account_number,
    clearStreetSymbol: position.symbol,
    quantity,
    averageCost,
    underlying: parsed!.underlying,
    expiration: parsed!.expiration,
    strike: parsed!.strike,
    optionType: parsed!.type,
    currentPrice,
    bid: contract?.bid ?? null,
    ask: contract?.ask ?? null,
    iv: contract?.iv ?? null,
    delta,
    gamma,
    theta,
    vega,
    marketValue,
    costBasis,
    unrealizedPnl,
    unrealizedPnlPercent,
    deltaExposure,
    gammaExposure,
    thetaExposure,
    vegaExposure,
    isOption: true,
    multiplier,
    source: "clear-street",
    enrichedAt: contract ? new Date() : null,
    error: contract ? undefined : "Could not find matching contract in options chain"
  }
}

/**
 * Enrich an equity position (no Greeks)
 */
function enrichEquityPosition(position: ClearStreetPosition): EnrichedPosition {
  const quantity = parseFloat(position.quantity)
  const averageCost = position.average_cost
  const multiplier = 1

  // For equities, we don't have real-time price from Clear Street
  // Would need to fetch from another source (e.g., Polygon quotes)
  const currentPrice = null
  const marketValue = 0
  const costBasis = quantity * averageCost * multiplier
  const unrealizedPnl = 0
  const unrealizedPnlPercent = 0

  return {
    accountId: position.account_id,
    accountNumber: position.account_number,
    clearStreetSymbol: position.symbol,
    quantity,
    averageCost,
    underlying: position.symbol,
    expiration: null,
    strike: null,
    optionType: null,
    currentPrice,
    bid: null,
    ask: null,
    iv: null,
    delta: quantity > 0 ? 1 : -1, // Delta of 1 for long equity, -1 for short
    gamma: null,
    theta: null,
    vega: null,
    marketValue,
    costBasis,
    unrealizedPnl,
    unrealizedPnlPercent,
    deltaExposure: quantity, // Each share = 1 delta
    gammaExposure: 0,
    thetaExposure: 0,
    vegaExposure: 0,
    isOption: false,
    multiplier,
    source: "clear-street",
    enrichedAt: null,
    error: "Equity position - no Greeks data"
  }
}

// ============ Main Enrichment Function ============

/**
 * Enrich all positions with Greeks from Polygon.io
 *
 * Groups positions by underlying/expiration to minimize API calls,
 * then matches each position to its contract in the options chain.
 */
export async function enrichPositionsWithGreeks(
  positions: ClearStreetPosition[]
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
        error: `Failed to fetch chain for ${group.underlying} ${group.expiration}: ${error instanceof Error ? error.message : "Unknown error"}`
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

  // Sort by underlying, then by expiration, then by strike
  enrichedPositions.sort((a, b) => {
    if (a.underlying !== b.underlying) {
      return a.underlying.localeCompare(b.underlying)
    }
    if (a.expiration !== b.expiration) {
      if (!a.expiration) return 1
      if (!b.expiration) return -1
      return a.expiration.localeCompare(b.expiration)
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
  totalCostBasis: number
  totalUnrealizedPnl: number
  totalDelta: number
  totalGamma: number
  totalTheta: number
  totalVega: number
} {
  const optionsCount = positions.filter((p) => p.isOption).length
  const equitiesCount = positions.filter((p) => !p.isOption).length

  const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValue, 0)
  const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasis, 0)
  const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0)
  const totalDelta = positions.reduce((sum, p) => sum + p.deltaExposure, 0)
  const totalGamma = positions.reduce((sum, p) => sum + p.gammaExposure, 0)
  const totalTheta = positions.reduce((sum, p) => sum + p.thetaExposure, 0)
  const totalVega = positions.reduce((sum, p) => sum + p.vegaExposure, 0)

  return {
    totalPositions: positions.length,
    optionsCount,
    equitiesCount,
    totalMarketValue,
    totalCostBasis,
    totalUnrealizedPnl,
    totalDelta,
    totalGamma,
    totalTheta,
    totalVega
  }
}
