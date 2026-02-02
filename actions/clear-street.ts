"use server"

/**
 * Clear Street Server Actions
 *
 * Server actions for fetching and managing Clear Street derivative positions.
 * All actions require authentication.
 */

import { requireAuth } from "@/lib/auth/permissions"
import {
  fetchPnlDetails,
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
 *
 * Uses /pnl-details endpoint for pricing and P&L data,
 * then enriches with Greeks from Polygon.io
 */
export async function getClearStreetPositions(): Promise<{
  isSuccess: boolean
  data?: ClearStreetPositionsResponse
  error?: string
}> {
  try {
    await requireAuth()

    // Fetch position-level P&L from Clear Street (includes pricing)
    const pnlDetails = await fetchPnlDetails()

    if (pnlDetails.length === 0) {
      return {
        isSuccess: true,
        data: {
          positions: [],
          summary: {
            totalPositions: 0,
            optionsCount: 0,
            equitiesCount: 0,
            totalMarketValue: 0,
            totalDayPnl: 0,
            totalUnrealizedPnl: 0,
            totalRealizedPnl: 0,
            totalPnl: 0,
            totalFees: 0,
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
      await enrichPositionsWithGreeks(pnlDetails)

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
 * Uses /pnl-details for pricing and P&L, skips Polygon Greeks
 */
export async function getClearStreetPositionsRaw(): Promise<{
  isSuccess: boolean
  data?: EnrichedPosition[]
  error?: string
}> {
  try {
    await requireAuth()

    const pnlDetails = await fetchPnlDetails()

    // Convert to enriched format with Clear Street data only (no Polygon Greeks)
    const enrichedPositions: EnrichedPosition[] = pnlDetails.map((pos) => {
      const quantity = parseFloat(pos.quantity)
      return {
        accountId: pos.account_id,
        accountNumber: pos.account_number,
        clearStreetSymbol: pos.symbol,
        quantity,
        underlying: pos.underlier || pos.symbol.split(/\d/)[0].trim(),
        expiration: null,
        strike: null,
        optionType: null,
        currentPrice: pos.price,
        sodPrice: pos.sod_price,
        bid: null,
        ask: null,
        iv: null,
        delta: null,
        gamma: null,
        theta: null,
        vega: null,
        marketValue: pos.net_market_value,
        sodMarketValue: pos.sod_market_value,
        dayPnl: pos.day_pnl,
        unrealizedPnl: pos.unrealized_pnl,
        realizedPnl: pos.realized_pnl,
        totalPnl: pos.total_pnl,
        overnightPnl: pos.overnight_pnl,
        totalFees: pos.total_fees,
        boughtQuantity: parseFloat(pos.bought_quantity) || 0,
        soldQuantity: parseFloat(pos.sold_quantity) || 0,
        buys: pos.buys,
        sells: pos.sells,
        deltaExposure: 0,
        gammaExposure: 0,
        thetaExposure: 0,
        vegaExposure: 0,
        isOption: pos.symbol.includes(" "), // OCC symbols have spaces
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
