import { NextResponse } from "next/server"
import { getClearStreetPositions } from "@/actions/clear-street"

export const dynamic = "force-dynamic"

/**
 * GET /api/clear-street/positions
 *
 * Fetch all Clear Street positions enriched with Greeks from Polygon.
 */
export async function GET() {
  const result = await getClearStreetPositions()

  if (!result.isSuccess) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json(result.data)
}
