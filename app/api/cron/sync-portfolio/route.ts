import { db } from "@/db"
import { fundPositions } from "@/db/schema/fund-positions"
import { companies } from "@/db/schema/companies"
import { eq } from "drizzle-orm"
import { google } from "googleapis"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const SPREADSHEET_ID = "1R5ZXjN3gDb7CVTrbUdqQU_HDLM2cFVUGS5CNynslAzE"
const LIVE_PORTFOLIO_SHEET = "Live Portfolio"

// Map position names to database tickers
const POSITION_TO_TICKER: Record<string, string> = {
  "American Bitcoin": "ABTC",
  "Bitcoin Treasury": "BTCT.V",
  "Oranje": "OBTC3",
  "DigitalX": "DCC.AX",
  "Aifinyo": "EBEN.HM",
  "Metaplanet": "3350.T",
  "LQWD": "LQWD.V",
  "Matador": "MATA.V",
  "Moon Inc": "1723.HK",
  "DV8": "DV8.BK",
  "Smarter Web": "SWC.AQ",
  "Capital B": "ALCPB.PA",
  "Satsuma": "SATS.L",
  "Bitplanet": "049470.KQ",
  "Treasury BV": "TRSR",
  "DigitalX Limited": "DCC.AX",
  "That's So Meta": "3350.T"
}

const CATEGORY_MARKERS: Record<string, string> = {
  "BTC": "btc",
  "BTC Equities": "btc_equities",
  "Cash": "cash",
  "Debt": "debt"
}

function getGoogleAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!credentials) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set")
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  })
}

function parseNumber(val: string | undefined | null): number | null {
  if (!val || val === "n/a" || val === "#DIV/0!") return null
  const cleaned = val.toString().replace(/[$€£¥₩฿₫R,\s%GBpCADHKDAUD]/gi, "").replace(/[()]/g, "-").trim()
  if (cleaned === "" || cleaned === "-") return null
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

async function findCompany(positionName: string) {
  for (const [name, ticker] of Object.entries(POSITION_TO_TICKER)) {
    if (positionName.toLowerCase().includes(name.toLowerCase())) {
      const [company] = await db.select().from(companies).where(eq(companies.ticker, ticker)).limit(1)
      return company
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() })
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${LIVE_PORTFOLIO_SHEET}'!A1:M200` // Increased to 200 rows for growth
    })

    const rows = response.data.values
    if (!rows || rows.length < 10) {
      return NextResponse.json({ error: "Insufficient data" }, { status: 500 })
    }

    // Build all positions first, then do atomic delete + insert
    const positionsToInsert: Array<{
      category: "btc" | "btc_equities" | "cash" | "debt" | "other"
      custodian: string
      positionName: string
      companyId: string | null
      quantity: string
      priceUsd: string | null
      valueUsd: string
      valueBtc: string | null
      weightPercent: string | null
      syncedAt: Date
    }> = []

    let currentCategory = "other"
    let skipped = 0

    for (let i = 5; i < rows.length; i++) {
      const row = rows[i]
      if (!row?.length) continue

      const col0 = row[0]?.toString().trim() || ""
      const col1 = row[1]?.toString().trim() || ""
      const col2 = row[2]?.toString().trim() || ""

      // Category header detection (check both column A and common patterns)
      if (CATEGORY_MARKERS[col0]) {
        currentCategory = CATEGORY_MARKERS[col0]
        continue
      }

      // Skip non-data rows (headers, empty, metrics)
      if (!col0 || col0.includes("Metrics") || col0.includes("Categories") || col0.includes("Total") || (!col1 && !col2)) continue

      const quantity = parseNumber(row[3])
      // Use column H (index 7) for Value (USD MTM) - live mark-to-market value
      // Column G (index 6) is cost basis, column H (index 7) is MTM
      const valueUsd = parseNumber(row[7]) ?? parseNumber(row[6])

      if (quantity === null || valueUsd === null) {
        skipped++
        continue
      }

      // Determine category from column B (more flexible matching)
      let category = currentCategory
      const col1Lower = col1.toLowerCase()
      if (col1Lower === "btc" || col1Lower.includes("bitcoin")) category = "btc"
      else if (col1Lower === "equities" || col1Lower.includes("equity")) category = "btc_equities"
      else if (col1Lower === "cash" || col1Lower.includes("usd")) category = "cash"
      else if (col1Lower === "debt" || col1Lower.includes("loan")) category = "debt"

      // Find linked company for equities
      let companyId: string | null = null
      if (category === "btc_equities") {
        const company = await findCompany(col2 || col0)
        if (company) companyId = company.id
      }

      positionsToInsert.push({
        category,
        custodian: col0,
        positionName: col2 || col0,
        companyId,
        quantity: quantity.toString(),
        priceUsd: parseNumber(row[5])?.toString() ?? null,
        valueUsd: valueUsd.toString(),
        valueBtc: parseNumber(row[8])?.toString() ?? null,
        weightPercent: parseNumber(row[9])?.toString() ?? null,
        syncedAt: new Date()
      })
    }

    // Only delete and insert if we have data (prevents accidental data loss)
    if (positionsToInsert.length === 0) {
      return NextResponse.json({ error: "No valid positions found", skipped }, { status: 500 })
    }

    // Atomic: delete all then insert all
    await db.delete(fundPositions)
    for (const position of positionsToInsert) {
      await db.insert(fundPositions).values(position)
    }

    const inserted = positionsToInsert.length

    return NextResponse.json({ success: true, inserted, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error("Portfolio sync error:", error)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
