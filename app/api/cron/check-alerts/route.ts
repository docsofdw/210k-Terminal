import { checkAllAlerts } from "@/actions/alerts"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await checkAllAlerts()

    return NextResponse.json({
      success: true,
      checked: result.checked,
      triggered: result.triggered,
      errors: result.errors.length > 0 ? result.errors : undefined,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Check alerts cron error:", error)
    return NextResponse.json(
      { error: "Failed to check alerts" },
      { status: 500 }
    )
  }
}
