import { NextRequest, NextResponse } from "next/server"
import { getOptionsExpirations } from "@/lib/api/polygon-options"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * GET /api/options/expirations/[symbol]
 *
 * Fetch available expiration dates for a symbol's options
 * Uses Polygon.io (Massive) Options API - full Greeks, serverless-friendly
 *
 * Response:
 * {
 *   symbol: "IBIT",
 *   expirations: ["2026-02-21", "2026-03-21", ...]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params
    const upperSymbol = symbol.toUpperCase()

    const result = await getOptionsExpirations(upperSymbol)

    if (!result) {
      return NextResponse.json(
        { error: `No options data available for ${upperSymbol}. This symbol may not have listed options.` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      symbol: result.symbol,
      expirations: result.expirations
    })
  } catch (error) {
    console.error("Options expirations API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch options expirations" },
      { status: 500 }
    )
  }
}
