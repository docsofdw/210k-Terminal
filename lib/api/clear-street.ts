/**
 * Clear Street Studio SDK Integration
 *
 * Wrapper for the Clear Street API to fetch derivative positions,
 * P&L data, and trade history.
 *
 * Documentation: https://docs.clearstreet.io/studio/
 */

import type {
  ClearStreetPosition,
  ClearStreetPnlSummary,
  ClearStreetPnlDetail,
  ClearStreetTrade,
  ClearStreetAccount,
  ClearStreetConfig,
  ClearStreetApiError
} from "@/types/clear-street"

// ============ Configuration ============

function getConfig(): ClearStreetConfig {
  const clientId = process.env.CLEAR_STREET_CLIENT_ID
  const clientSecret = process.env.CLEAR_STREET_CLIENT_SECRET
  const accountId = process.env.CLEAR_STREET_ACCOUNT_ID
  const entityId = process.env.CLEAR_STREET_ENTITY_ID
  const environment = (process.env.CLEAR_STREET_ENVIRONMENT || "production") as
    | "sandbox"
    | "production"

  if (!clientId || !clientSecret) {
    throw new Error(
      "Clear Street credentials not configured. Set CLEAR_STREET_CLIENT_ID and CLEAR_STREET_CLIENT_SECRET."
    )
  }

  if (!accountId) {
    throw new Error(
      "Clear Street account ID not configured. Set CLEAR_STREET_ACCOUNT_ID."
    )
  }

  return {
    clientId,
    clientSecret,
    accountId,
    entityId: entityId || "",
    environment
  }
}

// ============ Token Management ============

interface TokenCache {
  token: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

/**
 * Get an OAuth2 access token for Clear Street API
 * Caches the token and refreshes when expired
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token (with 5 min buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokenCache.token
  }

  const config = getConfig()

  const response = await fetch("https://auth.clearstreet.io/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      audience: "https://api.clearstreet.io"
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to get Clear Street access token: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  // Cache the token (expires_in is in seconds)
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000
  }

  return tokenCache.token
}

// ============ API Methods ============

/**
 * Fetch position-level P&L details for the configured account
 * Uses the /pnl-details endpoint which provides real-time pricing and P&L
 *
 * This is the primary endpoint for position data - includes:
 * - Current price and SOD price (mark-to-market cost basis)
 * - Day P&L, unrealized P&L, realized P&L, total P&L
 * - Market values (current and SOD)
 * - Trade activity (bought/sold quantities)
 * - Fees
 */
export async function fetchPnlDetails(): Promise<ClearStreetPnlDetail[]> {
  try {
    const token = await getAccessToken()
    const config = getConfig()

    const response = await fetch(
      `https://api.clearstreet.io/studio/v2/accounts/${config.accountId}/pnl-details`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`PnL Details API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    if (!data.data) {
      return []
    }

    // Filter to only options (skip cash positions)
    return data.data.filter(
      (item: ClearStreetPnlDetail) =>
        item.symbol !== "Cash - USD" && item.underlier !== "Cash - USD"
    )
  } catch (error) {
    console.error("Error fetching Clear Street P&L details:", error)
    throw new Error(
      `Failed to fetch P&L details: ${error instanceof Error ? error.message : "Unknown error"}`
    )
  }
}

/**
 * Fetch all positions (holdings) for the configured account
 * Note: This endpoint only returns basic position data (symbol, quantity)
 * For pricing and P&L, use fetchPnlDetails() instead
 */
export async function fetchPositions(): Promise<ClearStreetPosition[]> {
  try {
    const token = await getAccessToken()
    const config = getConfig()

    const response = await fetch(
      `https://api.clearstreet.io/studio/v2/accounts/${config.accountId}/holdings`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Holdings API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    if (!data.data) {
      return []
    }

    // Filter to only options (skip USD cash position)
    return data.data
      .filter((holding: { asset_class: string }) => holding.asset_class === "option")
      .map((holding: { symbol: string; quantity: string }) => ({
        account_id: data.account_id,
        account_number: data.account_number,
        average_cost: 0,
        quantity: holding.quantity,
        symbol: holding.symbol.trim()
      }))
  } catch (error) {
    console.error("Error fetching Clear Street holdings:", error)
    throw new Error(
      `Failed to fetch positions: ${error instanceof Error ? error.message : "Unknown error"}`
    )
  }
}

/**
 * Fetch a single position by symbol
 * Filters from all holdings to find the matching symbol
 */
export async function fetchPosition(
  symbol: string
): Promise<ClearStreetPosition | null> {
  try {
    const positions = await fetchPositions()
    return positions.find((p) => p.symbol === symbol) || null
  } catch (error) {
    console.error(`Error fetching position for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch P&L summary for the configured account
 */
export async function fetchPnlSummary(): Promise<ClearStreetPnlSummary | null> {
  try {
    const token = await getAccessToken()
    const config = getConfig()

    const response = await fetch(
      `https://api.clearstreet.io/studio/v2/accounts/${config.accountId}/pnl-summary`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`PnL API error: ${response.status} - ${errorText}`)
      return null
    }

    const data = await response.json()

    return {
      account_id: data.account_id ?? "",
      account_number: data.account_number ?? "",
      day_pnl: data.day_pnl ?? 0,
      overnight_pnl: data.overnight_pnl ?? 0,
      realized_pnl: data.realized_pnl ?? 0,
      unrealized_pnl: data.unrealized_pnl ?? 0,
      total_pnl: data.total_pnl ?? 0,
      net_pnl: data.net_pnl ?? 0,
      equity: data.equity ?? 0,
      long_market_value: data.long_market_value ?? 0,
      short_market_value: data.short_market_value ?? 0,
      gross_market_value: data.gross_market_value ?? 0,
      net_market_value: data.net_market_value ?? 0,
      total_fees: data.total_fees ?? 0,
      timestamp: data.timestamp ?? Date.now(),
      sod_equity: data.sod_equity,
      sod_long_market_value: data.sod_long_market_value,
      sod_short_market_value: data.sod_short_market_value,
      sod_gross_market_value: data.sod_gross_market_value
    }
  } catch (error) {
    console.error("Error fetching Clear Street P&L summary:", error)
    return null
  }
}

/**
 * Fetch entity-level P&L summary (if entity ID is configured)
 */
export async function fetchEntityPnlSummary(): Promise<ClearStreetPnlSummary | null> {
  try {
    const config = getConfig()

    if (!config.entityId) {
      console.warn("Entity ID not configured, skipping entity P&L fetch")
      return null
    }

    const token = await getAccessToken()
    const response = await fetch(
      `https://api.clearstreet.io/studio/v2/entities/${config.entityId}/pnl-summary`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    )

    if (!response.ok) {
      console.error(`Entity PnL API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    return {
      account_id: "",
      account_number: "",
      day_pnl: data.day_pnl ?? 0,
      overnight_pnl: data.overnight_pnl ?? 0,
      realized_pnl: data.realized_pnl ?? 0,
      unrealized_pnl: data.unrealized_pnl ?? 0,
      total_pnl: data.total_pnl ?? 0,
      net_pnl: data.net_pnl ?? 0,
      equity: data.equity ?? 0,
      long_market_value: data.long_market_value ?? 0,
      short_market_value: data.short_market_value ?? 0,
      gross_market_value: data.gross_market_value ?? 0,
      net_market_value: data.net_market_value ?? 0,
      total_fees: data.total_fees ?? 0,
      timestamp: data.timestamp ?? Date.now()
    }
  } catch (error) {
    console.error("Error fetching Clear Street entity P&L:", error)
    return null
  }
}

/**
 * Fetch recent trades for the configured account
 * Note: This endpoint may return 403 depending on API key permissions
 */
export async function fetchTrades(options?: {
  startDate?: Date
  endDate?: Date
  pageSize?: number
}): Promise<ClearStreetTrade[]> {
  try {
    const token = await getAccessToken()
    const config = getConfig()

    const response = await fetch(
      `https://api.clearstreet.io/studio/v2/accounts/${config.accountId}/trades`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    )

    if (!response.ok) {
      // Trades endpoint returns 403 for some API keys - this is expected
      if (response.status === 403) {
        console.warn("Trades access denied - API key may not have trades permission")
        return []
      }
      console.error(`Trades API error: ${response.status}`)
      return []
    }

    const data = await response.json()

    if (!data.data) {
      return []
    }

    let trades: ClearStreetTrade[] = data.data.map((trade: Record<string, unknown>) => ({
      trade_id: trade.trade_id as string,
      order_id: trade.order_id as string,
      symbol: (trade.symbol as string) ?? "",
      side: trade.side as "buy" | "sell" | "sell-short",
      quantity: trade.quantity as string,
      price: trade.price as string,
      running_position: trade.running_position as string,
      created_at: trade.created_at as number,
      account_id: trade.account_id as string,
      account_number: trade.account_number as string
    }))

    if (options?.startDate) {
      const startMs = options.startDate.getTime()
      trades = trades.filter((t) => t.created_at >= startMs)
    }

    if (options?.endDate) {
      const endMs = options.endDate.getTime()
      trades = trades.filter((t) => t.created_at <= endMs)
    }

    return trades
  } catch (error) {
    console.error("Error fetching Clear Street trades:", error)
    return []
  }
}

/**
 * Fetch account information
 */
export async function fetchAccount(): Promise<ClearStreetAccount | null> {
  try {
    const token = await getAccessToken()

    const response = await fetch(
      "https://api.clearstreet.io/studio/v2/accounts",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    )

    if (!response.ok) {
      console.error(`Accounts API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data.data || data.data.length === 0) {
      return null
    }

    // Return the first account (or find the configured one)
    const config = getConfig()
    const account = data.data.find(
      (a: { account_id: string }) => a.account_id === config.accountId
    ) || data.data[0]

    return {
      account_id: account.account_id,
      account_number: account.account_number,
      name: account.name,
      entity_id: account.entity_id
    }
  } catch (error) {
    console.error("Error fetching Clear Street account:", error)
    return null
  }
}

/**
 * Test the Clear Street API connection
 */
export async function testConnection(): Promise<{
  success: boolean
  message: string
  account?: ClearStreetAccount
}> {
  try {
    const account = await fetchAccount()

    if (!account) {
      return {
        success: false,
        message: "Failed to fetch account information"
      }
    }

    return {
      success: true,
      message: `Connected to account ${account.account_number}`,
      account
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Clear the token cache (useful for testing or forced refresh)
 */
export function clearTokenCache(): void {
  tokenCache = null
}

/**
 * Fetch activity data for the entity (trade history with cost basis)
 * Uses the v2 API endpoint: POST /entities/{entity_id}/activity
 *
 * Note: This endpoint returns historical activity including:
 * - Trade details (price, quantity, side)
 * - Cost basis and gross/net amounts
 * - Commission and fees
 */
export async function fetchEntityActivity(options?: {
  startDate?: string // YYYY-MM-DD format
  endDate?: string
  activityType?: "TRADES" | "JOURNALS" | "TRADES_AND_JOURNALS"
}): Promise<{
  success: boolean
  data?: unknown[]
  error?: string
  rawResponse?: unknown
}> {
  try {
    const config = getConfig()

    if (!config.entityId) {
      return {
        success: false,
        error: "Entity ID not configured"
      }
    }

    const token = await getAccessToken()

    // Build request body per Clear Street API spec
    const body: Record<string, unknown> = {
      activity_data_type: options?.activityType || "TRADES"
    }

    // Add date range if provided
    if (options?.startDate && options?.endDate) {
      body.effective_date_range = {
        inclusive_start_date: options.startDate,
        exclusive_end_date: options.endDate
      }
    }

    const response = await fetch(
      `https://api.clearstreet.io/studio/v2/entities/${config.entityId}/activity`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(body)
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Activity API error: ${response.status} - ${errorText}`
      }
    }

    const data = await response.json()

    return {
      success: true,
      data: data.data || data,
      rawResponse: data
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}
