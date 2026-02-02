import { NextResponse } from "next/server"
import { getClearStreetPnl } from "@/actions/clear-street"

export const dynamic = "force-dynamic"

/**
 * GET /api/clear-street/pnl
 *
 * Fetch P&L summary from Clear Street.
 */
export async function GET() {
  const result = await getClearStreetPnl()

  if (!result.isSuccess) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json(result.data)
}
