import { NextRequest, NextResponse } from "next/server"
import { getOptionsChain } from "@/lib/api/polygon-options"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * GET /api/options/chain/[symbol]?expiration=2026-03-21
 *
 * Fetch options chain for a symbol and expiration date
 * Uses Polygon.io (Massive) Options API - full Greeks, serverless-friendly
 *
 * Query params:
 * - expiration: ISO date string (required)
 *
 * Response:
 * {
 *   symbol: "IBIT",
 *   expiration: "2026-03-21",
 *   underlyingPrice: 55.50,
 *   daysToExpiry: 45,
 *   calls: [...],
 *   puts: [...]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params
    const upperSymbol = symbol.toUpperCase()

    const { searchParams } = new URL(request.url)
    const expiration = searchParams.get("expiration")

    if (!expiration) {
      return NextResponse.json(
        { error: "Missing required parameter: expiration" },
        { status: 400 }
      )
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(expiration)) {
      return NextResponse.json(
        { error: "Invalid expiration format. Use YYYY-MM-DD" },
        { status: 400 }
      )
    }

    const result = await getOptionsChain(upperSymbol, expiration)

    if (!result) {
      return NextResponse.json(
        { error: `No options chain found for ${upperSymbol} expiring ${expiration}` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      symbol: result.symbol,
      expiration: result.expiration,
      underlyingPrice: result.underlyingPrice,
      daysToExpiry: result.daysToExpiry,
      calls: result.calls,
      puts: result.puts
    })
  } catch (error) {
    console.error("Options chain API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch options chain" },
      { status: 500 }
    )
  }
}
