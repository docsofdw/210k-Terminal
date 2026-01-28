import { db } from "@/db"
import { companies } from "@/db/schema/companies"
import { btcPrices } from "@/db/schema/btc-prices"
import { eq } from "drizzle-orm"
import { google } from "googleapis"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const SPREADSHEET_ID = "1fNQGJIaDT3czM7Bqd9dZ6WTJYk-54niL9F3Pe9zYgpQ"
const COMPS_TABLE_SHEET = "Comps Table"

// Map sheet company names to database tickers
const COMPANY_NAME_TO_TICKER: Record<string, string> = {
  Strategy: "MSTR",
  Metaplanet: "3350.T",
  LQWD: "LQWD.V",
  Matador: "MATA.V",
  "Moon Inc": "1723.HK",
  "Smarter Web Company": "SWC.AQ",
  "Capital B": "ALCPB.PA",
  H100: "H100",
  DV8: "DV8.BK",
  BTCT: "BTCT.V",
  satsuma: "SATS.L",
  DigitalX: "DCC.AX",
  aifinyo: "EBEN.HM",
  bitplanet: "049470.KQ",
  oranje: "OBTC3",
  ABTC: "ABTC"
}

// Row indices in the sheet (0-indexed from A1)
const ROW_INDICES = {
  COMPANY_NAMES: 2, // Row 3 - company names
  BTC_HOLDINGS: 3, // Row 4 - BTC in treasury
  SHARE_COUNT: 5, // Row 6 - Share count
  DEBT_USD: 9, // Row 10 - Debt (USD)
  PREFERREDS: 10, // Row 11 - Preferreds
  CASH_USD: 11 // Row 12 - Cash (USD)
}

function getGoogleAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!credentials) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set")
  }

  const parsed = JSON.parse(credentials)
  return new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  })
}

function parseNumber(val: string | undefined | null): number | null {
  if (!val) return null
  const cleaned = val
    .toString()
    .replace(/[$€£¥₩฿,\s%]/g, "")
    .replace(/[()]/g, "-")
    .trim()

  if (cleaned === "" || cleaned === "-") return null

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function findTicker(companyName: string): string | null {
  // Direct match
  if (COMPANY_NAME_TO_TICKER[companyName]) {
    return COMPANY_NAME_TO_TICKER[companyName]
  }

  // Case-insensitive match
  const lowerName = companyName.toLowerCase().trim()
  for (const [name, ticker] of Object.entries(COMPANY_NAME_TO_TICKER)) {
    if (name.toLowerCase() === lowerName) {
      return ticker
    }
  }

  return null
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const auth = getGoogleAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // Fetch sheet data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${COMPS_TABLE_SHEET}'!A1:AZ20`
    })

    const rows = response.data.values
    if (!rows || rows.length < 15) {
      return NextResponse.json(
        { error: "Insufficient data in sheet" },
        { status: 500 }
      )
    }

    // Extract BTC price from B3 cell
    const btcPriceCell = rows[2]?.[1]
    const btcPrice = parseNumber(btcPriceCell)

    // Get company data rows
    const companyRow = rows[ROW_INDICES.COMPANY_NAMES]
    const btcRow = rows[ROW_INDICES.BTC_HOLDINGS]
    const shareRow = rows[ROW_INDICES.SHARE_COUNT]
    const debtRow = rows[ROW_INDICES.DEBT_USD]
    const preferredsRow = rows[ROW_INDICES.PREFERREDS]
    const cashRow = rows[ROW_INDICES.CASH_USD]

    let updated = 0
    let skipped = 0

    // Process each company column (starting from column C, index 2)
    for (let col = 2; col < companyRow.length; col++) {
      const name = companyRow[col]?.toString().trim()
      if (!name) continue

      const ticker = findTicker(name)
      if (!ticker) continue

      // Find company in database
      const [existing] = await db
        .select()
        .from(companies)
        .where(eq(companies.ticker, ticker))
        .limit(1)

      if (!existing) {
        skipped++
        continue
      }

      // Update company with financial data
      await db
        .update(companies)
        .set({
          btcHoldings: parseNumber(btcRow?.[col])?.toString() ?? existing.btcHoldings,
          sharesOutstanding: parseNumber(shareRow?.[col])?.toString() ?? existing.sharesOutstanding,
          debtUsd: parseNumber(debtRow?.[col])?.toString() ?? existing.debtUsd,
          preferredsUsd: parseNumber(preferredsRow?.[col])?.toString() ?? existing.preferredsUsd,
          cashUsd: parseNumber(cashRow?.[col])?.toString() ?? existing.cashUsd,
          btcHoldingsDate: new Date(),
          btcHoldingsSource: "Google Sheets cron sync",
          updatedAt: new Date()
        })
        .where(eq(companies.id, existing.id))

      updated++
    }

    // Insert BTC price if available
    if (btcPrice) {
      await db.insert(btcPrices).values({
        priceUsd: btcPrice.toString(),
        priceAt: new Date()
      })
    }

    return NextResponse.json({
      success: true,
      updated,
      skipped,
      btcPrice,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Google Sheets sync cron error:", error)
    return NextResponse.json(
      { error: "Failed to sync from Google Sheets" },
      { status: 500 }
    )
  }
}
