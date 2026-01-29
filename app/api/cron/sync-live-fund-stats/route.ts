import { db } from "@/db"
import { fundPerformanceSnapshots } from "@/db/schema/fund-performance"
import { eq, and, gte, lte } from "drizzle-orm"
import { google } from "googleapis"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const SPREADSHEET_ID = "1R5ZXjN3gDb7CVTrbUdqQU_HDLM2cFVUGS5CNynslAzE"
const LIVE_PORTFOLIO_SHEET = "Live Portfolio"

function getGoogleAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!credentials) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set")
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  })
}

function parseNumber(val: string | undefined | null): number | null {
  if (!val || val === "n/a" || val === "#DIV/0!" || val === "#N/A" || val === "-") return null
  const cleaned = val.toString().replace(/[$€£¥₩฿₫R,\s%]/gi, "").replace(/[()]/g, "-").trim()
  if (cleaned === "" || cleaned === "-") return null
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() })

    // Fetch rows 1-4 from Live Portfolio sheet (summary data)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${LIVE_PORTFOLIO_SHEET}'!A1:K4`
    })

    const rows = response.data.values
    if (!rows || rows.length < 4) {
      return NextResponse.json({ error: "Insufficient data from Live Portfolio sheet" }, { status: 500 })
    }

    const row1 = rows[0] || []
    const row3 = rows[2] || []
    const row4 = rows[3] || []

    // Parse values
    // Row 1: Live AUM (B1), Fund MTD (F1)
    const liveAumUsd = parseNumber(row1[1])
    const fundMtdPercent = parseNumber(row1[5]) // e.g., 10.9 means 10.9%

    // Row 3: Live BTC Price (B3)
    const liveBtcPrice = parseNumber(row3[1])

    // Row 4: Bitcoin AUM in BTC (B4)
    const bitcoinAum = parseNumber(row4[1])

    if (liveAumUsd === null) {
      return NextResponse.json({ error: "Could not parse Live AUM" }, { status: 500 })
    }

    // Create snapshot date as end of current month (for current month's data)
    const now = new Date()
    const snapshotDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))

    // Check if we already have a snapshot for this month
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

    const existing = await db.select()
      .from(fundPerformanceSnapshots)
      .where(
        and(
          gte(fundPerformanceSnapshots.snapshotDate, startOfMonth),
          lte(fundPerformanceSnapshots.snapshotDate, endOfMonth)
        )
      )
      .limit(1)

    const snapshotData = {
      snapshotDate,
      fundAumUsd: liveAumUsd.toString(),
      fundAumBtc: bitcoinAum?.toString() ?? null,
      btcPriceAtSnapshot: liveBtcPrice?.toString() ?? null,
      netReturnMtd: fundMtdPercent !== null ? (fundMtdPercent / 100).toString() : null,
      sourceSheet: "Live Portfolio (live sync)",
      rawData: { row1, row3, row4, fetchedAt: now.toISOString() },
      syncedAt: now
    }

    if (existing.length > 0) {
      // Update existing snapshot for this month
      await db.update(fundPerformanceSnapshots)
        .set(snapshotData)
        .where(eq(fundPerformanceSnapshots.id, existing[0].id))

      return NextResponse.json({
        success: true,
        action: "updated",
        snapshotDate: snapshotDate.toISOString(),
        data: {
          fundAumUsd: liveAumUsd,
          fundMtdPercent,
          liveBtcPrice,
          bitcoinAum
        },
        timestamp: now.toISOString()
      })
    } else {
      // Insert new snapshot for this month
      await db.insert(fundPerformanceSnapshots).values(snapshotData)

      return NextResponse.json({
        success: true,
        action: "inserted",
        snapshotDate: snapshotDate.toISOString(),
        data: {
          fundAumUsd: liveAumUsd,
          fundMtdPercent,
          liveBtcPrice,
          bitcoinAum
        },
        timestamp: now.toISOString()
      })
    }
  } catch (error) {
    console.error("Live fund stats sync error:", error)
    return NextResponse.json({
      error: "Sync failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
