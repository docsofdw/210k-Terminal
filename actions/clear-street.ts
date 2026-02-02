"use server"

/**
 * Clear Street Server Actions
 *
 * Server actions for fetching and managing Clear Street derivative positions.
 * All actions require authentication.
 */

import { requireAuth } from "@/lib/auth/permissions"
import {
  fetchPositions,
  fetchPnlSummary,
  fetchTrades,
  fetchAccount,
  testConnection
} from "@/lib/api/clear-street"
import {
  enrichPositionsWithGreeks,
  calculatePositionsSummary
} from "@/lib/services/position-enrichment"
import type {
  ClearStreetPositionsResponse,
  ClearStreetPnlResponse,
  ClearStreetTrade,
  ClearStreetAccount,
  EnrichedPosition
} from "@/types/clear-street"

// ============ Position Actions ============

/**
 * Get all Clear Street positions, enriched with Greeks from Polygon
 */
export async function getClearStreetPositions(): Promise<{
  isSuccess: boolean
  data?: ClearStreetPositionsResponse
  error?: string
}> {
  try {
    await requireAuth()

    // Fetch positions from Clear Street
    const positions = await fetchPositions()

    if (positions.length === 0) {
      return {
        isSuccess: true,
        data: {
          positions: [],
          summary: {
            totalPositions: 0,
            optionsCount: 0,
            equitiesCount: 0,
            totalMarketValue: 0,
            totalUnrealizedPnl: 0,
            totalDelta: 0,
            totalGamma: 0,
            totalTheta: 0,
            totalVega: 0
          },
          updatedAt: new Date()
        }
      }
    }

    // Enrich with Greeks from Polygon
    const { positions: enrichedPositions, errors } =
      await enrichPositionsWithGreeks(positions)

    // Log any enrichment errors (but don't fail the request)
    if (errors.length > 0) {
      console.warn("Position enrichment warnings:", errors)
    }

    // Calculate summary statistics
    const summary = calculatePositionsSummary(enrichedPositions)

    return {
      isSuccess: true,
      data: {
        positions: enrichedPositions,
        summary,
        updatedAt: new Date()
      }
    }
  } catch (error) {
    console.error("Error in getClearStreetPositions:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Failed to fetch positions"
    }
  }
}

/**
 * Get Clear Street positions without Greek enrichment (faster)
 */
export async function getClearStreetPositionsRaw(): Promise<{
  isSuccess: boolean
  data?: EnrichedPosition[]
  error?: string
}> {
  try {
    await requireAuth()

    const positions = await fetchPositions()

    // Convert to enriched format but without actual enrichment
    const enrichedPositions: EnrichedPosition[] = positions.map((pos) => {
      const quantity = parseFloat(pos.quantity)
      return {
        accountId: pos.account_id,
        accountNumber: pos.account_number,
        clearStreetSymbol: pos.symbol,
        quantity,
        averageCost: pos.average_cost,
        underlying: pos.symbol.split(/\d/)[0].trim(), // Basic underlying extraction
        expiration: null,
        strike: null,
        optionType: null,
        currentPrice: null,
        bid: null,
        ask: null,
        iv: null,
        delta: null,
        gamma: null,
        theta: null,
        vega: null,
        marketValue: 0,
        costBasis: quantity * pos.average_cost * 100,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        deltaExposure: 0,
        gammaExposure: 0,
        thetaExposure: 0,
        vegaExposure: 0,
        isOption: true,
        multiplier: 100,
        source: "clear-street",
        enrichedAt: null
      }
    })

    return {
      isSuccess: true,
      data: enrichedPositions
    }
  } catch (error) {
    console.error("Error in getClearStreetPositionsRaw:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Failed to fetch positions"
    }
  }
}

// ============ P&L Actions ============

/**
 * Get P&L summary for the Clear Street account
 */
export async function getClearStreetPnl(): Promise<{
  isSuccess: boolean
  data?: ClearStreetPnlResponse
  error?: string
}> {
  try {
    await requireAuth()

    const pnl = await fetchPnlSummary()

    if (!pnl) {
      return {
        isSuccess: false,
        error: "Failed to fetch P&L summary"
      }
    }

    return {
      isSuccess: true,
      data: {
        pnl,
        updatedAt: new Date()
      }
    }
  } catch (error) {
    console.error("Error in getClearStreetPnl:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Failed to fetch P&L"
    }
  }
}

// ============ Trade Actions ============

/**
 * Get recent trades from Clear Street
 */
export async function getClearStreetTrades(options?: {
  startDate?: string
  endDate?: string
  pageSize?: number
}): Promise<{
  isSuccess: boolean
  data?: ClearStreetTrade[]
  error?: string
}> {
  try {
    await requireAuth()

    const trades = await fetchTrades({
      startDate: options?.startDate ? new Date(options.startDate) : undefined,
      endDate: options?.endDate ? new Date(options.endDate) : undefined,
      pageSize: options?.pageSize
    })

    return {
      isSuccess: true,
      data: trades
    }
  } catch (error) {
    console.error("Error in getClearStreetTrades:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Failed to fetch trades"
    }
  }
}

// ============ Account Actions ============

/**
 * Get Clear Street account information
 */
export async function getClearStreetAccount(): Promise<{
  isSuccess: boolean
  data?: ClearStreetAccount
  error?: string
}> {
  try {
    await requireAuth()

    const account = await fetchAccount()

    if (!account) {
      return {
        isSuccess: false,
        error: "Failed to fetch account information"
      }
    }

    return {
      isSuccess: true,
      data: account
    }
  } catch (error) {
    console.error("Error in getClearStreetAccount:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Failed to fetch account"
    }
  }
}

/**
 * Test the Clear Street API connection
 */
export async function testClearStreetConnection(): Promise<{
  isSuccess: boolean
  message: string
  data?: ClearStreetAccount
}> {
  try {
    await requireAuth()

    const result = await testConnection()

    return {
      isSuccess: result.success,
      message: result.message,
      data: result.account
    }
  } catch (error) {
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Connection test failed"
    }
  }
}

// ============ Combined Data Actions ============

/**
 * Get all Clear Street data (positions + P&L) in one call
 */
export async function getClearStreetDashboardData(): Promise<{
  isSuccess: boolean
  data?: {
    positions: ClearStreetPositionsResponse
    pnl: ClearStreetPnlResponse | null
  }
  error?: string
}> {
  try {
    await requireAuth()

    // Fetch positions and P&L in parallel
    const [positionsResult, pnlResult] = await Promise.all([
      getClearStreetPositions(),
      getClearStreetPnl()
    ])

    if (!positionsResult.isSuccess || !positionsResult.data) {
      return {
        isSuccess: false,
        error: positionsResult.error || "Failed to fetch positions"
      }
    }

    return {
      isSuccess: true,
      data: {
        positions: positionsResult.data,
        pnl: pnlResult.isSuccess ? pnlResult.data! : null
      }
    }
  } catch (error) {
    console.error("Error in getClearStreetDashboardData:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Failed to fetch dashboard data"
    }
  }
}
