import { NextResponse } from "next/server"
import { getClearStreetTrades } from "@/actions/clear-street"

export const dynamic = "force-dynamic"

/**
 * GET /api/clear-street/trades
 *
 * Fetch recent trades from Clear Street.
 * Optional query params: startDate, endDate, pageSize
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const options = {
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    pageSize: searchParams.get("pageSize")
      ? parseInt(searchParams.get("pageSize")!)
      : undefined
  }

  const result = await getClearStreetTrades(options)

  if (!result.isSuccess) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json(result.data)
}
